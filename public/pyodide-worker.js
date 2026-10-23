/* global loadPyodide, importScripts */
// Classic Web Worker running Pyodide: Python executes on the user's CPU (WebAssembly),
// isolated from the UI thread. Messages: {id, type: 'init' | 'exec', ...}.

let pyodide = null
let harness = null
let readyPromise = null

async function boot(indexURL, harnessURL) {
  importScripts(indexURL + 'pyodide.js')
  pyodide = await loadPyodide({ indexURL })
  pyodide.runPython("import os; os.environ['MPLBACKEND'] = 'Agg'")
  const source = await (await fetch(harnessURL)).text()
  pyodide.FS.writeFile('/home/pyodide/harness.py', source)
  harness = pyodide.pyimport('harness')
  // Warm up the most used package in the background of the first session.
  pyodide.loadPackage(['numpy']).catch(() => {})
}

self.onmessage = async (event) => {
  const { id, type } = event.data
  try {
    if (type === 'init') {
      readyPromise = readyPromise || boot(event.data.indexURL, event.data.harnessURL)
      await readyPromise
      self.postMessage({ id, ok: true, version: pyodide.version })
      return
    }
    if (type === 'exec') {
      await readyPromise
      const { payload, sources } = event.data
      const progress = (msg) => self.postMessage({ id, progress: msg })
      // One call per source: a syntax error in the user's code must not hide the imports
      // of the reference solution or the tests.
      for (const source of sources) {
        if (!source) continue
        await pyodide.loadPackagesFromImports(source, {
          messageCallback: (m) => progress(m),
          errorCallback: (m) => progress(m),
        })
      }
      const json = harness.run(JSON.stringify(payload))
      self.postMessage({ id, ok: true, result: JSON.parse(json) })
    }
  } catch (err) {
    self.postMessage({ id, ok: false, error: String((err && err.message) || err) })
  }
}
