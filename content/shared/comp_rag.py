"""Competition « Nimbus Mobile help centre »: find the right help article for each customer question.
Hand-written corpus; the answers of the test questions are hidden."""
import pandas as pd

_ARTICLES = [
    ("a01", "Billing", "Understanding your monthly bill", "Your monthly bill shows your plan fee, any extra usage such as calls to premium numbers or data top-ups, and taxes. Bills are issued on the 5th of each month and can be downloaded as a PDF from the My Account app under Billing > Invoices."),
    ("a02", "Billing", "Payment methods", "You can pay by direct debit, credit or debit card, or bank transfer. To change your payment method, go to My Account > Billing > Payment method. Direct debit payments are collected 10 days after the bill is issued."),
    ("a03", "Billing", "Late or missed payment", "If a payment fails, we retry after 5 days and send an SMS reminder. After 15 days without payment, outgoing calls are restricted until the balance is settled. A late payment fee of 7 euros applies."),
    ("a04", "Billing", "Disputing a charge", "If you think a charge on your bill is wrong, open a dispute within 60 days from My Account > Billing > Report a problem. Disputed amounts are put on hold while our team investigates, usually within 10 working days."),
    ("a05", "Billing", "Refunds", "Refunds for overcharges or cancelled services are paid back to your original payment method within 14 days. The credit can also be applied to your next bill if you prefer."),
    ("a06", "Plans", "Changing your mobile plan", "You can upgrade your plan at any time: the new allowance applies immediately and the price difference is prorated. Downgrades take effect at the start of your next billing cycle."),
    ("a07", "Plans", "Data top-ups", "If you run out of mobile data before the end of the month, buy a data top-up of 5 GB or 20 GB in the app. Top-ups are valid until your allowance renews, and unused top-up data does not roll over."),
    ("a08", "Plans", "Family plan and shared data", "A family plan lets up to five lines share one data allowance. The account holder can set a monthly data limit for each member and add or remove lines from My Account > Family."),
    ("a09", "Plans", "Student discount", "Students aged 18 to 26 get 20% off any unlimited plan. Upload a valid student card in the app; the discount is checked again every 12 months."),
    ("a10", "Roaming", "Using your phone in Europe", "Calls, texts and data in EU countries are included in your plan at no extra cost under the roam-like-at-home rules, within a fair-use data limit shown in the app."),
    ("a11", "Roaming", "Travelling outside Europe", "Outside the EU, roaming is charged per day with a travel pass: 10 euros per day for 1 GB in the USA, Canada and Switzerland. Without a pass, standard international rates apply and can be expensive."),
    ("a12", "Roaming", "Roaming not working", "If you cannot connect abroad, check that data roaming is enabled in your phone settings, restart the phone, and select a partner network manually. Roaming must also be activated on your line, which it is by default."),
    ("a13", "Roaming", "International calls from home", "Calls to foreign numbers from your home country are not included in standard plans. Add the World Calls option for 5 euros per month to get 300 minutes to 50 destinations."),
    ("a14", "Network", "No signal or poor coverage", "Check our live coverage map for planned works or outages in your area. Indoors, enable Wi-Fi calling to make calls over your home internet when the mobile signal is weak."),
    ("a15", "Network", "Enabling 5G", "5G is included in all plans at no extra cost. You need a 5G-compatible phone and to be in a covered area. Turn on 5G in your phone's mobile network settings."),
    ("a16", "Network", "Slow mobile data", "Data speed can drop when you reach your fair-use limit, in crowded places, or with a weak signal. Restart your phone, check whether you have exceeded your allowance, and run a speed test from the app."),
    ("a17", "Network", "Wi-Fi calling", "Wi-Fi calling lets you make and receive calls over a Wi-Fi connection, for example in a basement with no mobile coverage. Activate it in your phone settings; calls are counted like normal calls."),
    ("a18", "Devices", "Unlocking your phone", "Phones bought from us are unlocked for free after 6 months of service. Request the unlock code in My Account > Devices; you will receive it by email within 48 hours."),
    ("a19", "Devices", "Phone repair and warranty", "Devices have a 2-year manufacturer warranty covering hardware faults. Book a repair in store or by post; screen damage and water damage are not covered unless you have device insurance."),
    ("a20", "Devices", "Device insurance", "Device insurance covers accidental damage, theft and loss for 9 euros per month. Claims are made in the app with a police report for theft; a 50 euro excess applies per claim."),
    ("a21", "Devices", "Paying for a phone in instalments", "You can spread the price of a new phone over 12, 24 or 36 months with zero interest. Instalments appear as a separate line on your bill, and the remaining balance becomes due if you leave."),
    ("a22", "Devices", "Trade in your old phone", "Send us your old phone and get credit towards a new one. The value depends on the model and condition; we email you a quote within 3 days of receiving it."),
    ("a23", "Account", "Lost or stolen phone", "Report a lost or stolen phone immediately in My Account or by calling 700 from another line. We block your SIM card to prevent fraudulent use and can send a replacement SIM to your address."),
    ("a24", "Account", "Getting a new SIM or an eSIM", "Order a new physical SIM or switch to an eSIM in the app. An eSIM is activated by scanning a QR code; your number and plan stay the same."),
    ("a25", "Account", "Keeping your number when switching operator", "To move your number to another operator, ask for your number transfer code (RIO) by calling 3179. Give the code to your new operator; your contract with us ends automatically when the transfer is completed."),
    ("a26", "Account", "Changing your personal details", "Update your address, email or contact phone in My Account > Profile. A change of account holder requires both people to sign a transfer form in store."),
    ("a27", "Account", "Password and login problems", "If you forgot your password, use Forgot password on the login page to receive a reset link by email. After five failed attempts, your account is locked for 30 minutes for security."),
    ("a28", "Internet box", "Installing your internet box", "Plug the box into the phone or fibre socket, connect the power cable and wait for the light to turn white. Setup takes up to 10 minutes; the Wi-Fi name and password are on the sticker under the box."),
    ("a29", "Internet box", "No internet at home", "Restart the box by unplugging it for 30 seconds. If the light stays red, check the cable connections and the outage map. You can also run a line test from the app."),
    ("a30", "Internet box", "Improving home Wi-Fi", "Place the box in a central, open position away from thick walls. For large homes, add a Wi-Fi repeater (mesh extender), available for rent at 3 euros per month."),
    ("a31", "Internet box", "Moving house with your internet", "Tell us your new address at least 3 weeks before moving. We check fibre availability, schedule a technician if needed, and transfer your contract without fees."),
    ("a32", "Internet box", "Returning equipment", "When your internet contract ends, return the box and any repeaters within 30 days using the prepaid label. Unreturned equipment is charged 100 euros."),
    ("a33", "Contract", "Cancelling your contract", "You can terminate a contract without commitment at any time with 10 days notice, from My Account > Contract > Cancel. If you are still in a 12 or 24 month commitment, the remaining months are charged."),
    ("a34", "Contract", "Commitment period and early termination", "Some offers include a 12 or 24 month minimum term. Leaving early means paying the remaining monthly fees of the commitment, except when moving abroad or in case of long illness with proof."),
    ("a35", "Contract", "Price changes", "We notify you at least one month before any price increase. You can then cancel without fees within 4 months of the change taking effect."),
    ("a36", "Contract", "Complaints and mediation", "If you are unhappy with how your problem was handled, file a complaint in My Account > Help > Complaint. If you get no satisfactory answer within 2 months, you can contact the independent telecom mediator for free."),
]

# (article, labelled question, two test questions)
_QUESTIONS = [
    ("a01", "Where can I download my invoice as a PDF?", "When is my monthly statement issued?", "What are all these lines on my bill?"),
    ("a02", "How do I switch from card payment to direct debit?", "Can I pay my bill with a bank transfer?", "When is the money taken from my account with automatic payment?"),
    ("a03", "What happens if my payment fails?", "Why can I no longer make outgoing calls after not paying?", "Is there a fee if I pay my bill late?"),
    ("a04", "I think I was charged for something I didn't use, what do I do?", "How long do I have to contest an amount on my invoice?", "How long does the investigation of a wrong charge take?"),
    ("a05", "When will I get my money back after an overcharge?", "Can the refund go on my next bill instead?", "How long does a reimbursement take?"),
    ("a06", "Can I upgrade to a bigger plan in the middle of the month?", "When does a cheaper plan start if I downgrade?", "How is the price calculated if I switch plans mid-cycle?"),
    ("a07", "I ran out of data, how can I buy more?", "Does unused extra data carry over to next month?", "What sizes of additional data packs are available?"),
    ("a08", "Can my kids share my data allowance?", "How many lines can be on one family plan?", "How do I limit the data used by a family member?"),
    ("a09", "Is there a discount for students?", "I'm 22 and at university, can I get a cheaper plan?", "What document do I need for the student reduction?"),
    ("a10", "Does my plan work in Spain?", "Will I pay extra for data on holiday in Italy?", "What is the fair-use limit when roaming in the EU?"),
    ("a11", "How much does it cost to use my phone in the USA?", "Is there a daily pass for travelling to Canada?", "Why was my bill so high after a trip to Thailand?"),
    ("a12", "My phone has no internet abroad, what should I check?", "How do I choose a partner network manually when travelling?", "Data is not working since I landed in Portugal"),
    ("a13", "How much are calls from France to Morocco?", "Is there an option for calling foreign numbers from home?", "How many international minutes do I get with World Calls?"),
    ("a14", "I have no signal in my area, is there an outage?", "Where can I see the coverage map?", "My calls keep dropping inside my house"),
    ("a15", "How do I activate 5G?", "Does 5G cost extra?", "Why doesn't my phone show 5G?"),
    ("a16", "Why is my mobile internet so slow?", "How do I test my data speed?", "My 4G became very slow at the end of the month"),
    ("a17", "Can I make calls over my Wi-Fi?", "I have no coverage in my basement office, how can I still take calls?", "Are calls over Wi-Fi charged differently?"),
    ("a18", "How do I get my phone unlocked to use another SIM?", "When will I receive the unlock code?", "Is unlocking my handset free?"),
    ("a19", "My phone stopped working, is it under warranty?", "Is a cracked screen covered by the guarantee?", "How do I send my phone for repair?"),
    ("a20", "Does insurance cover a stolen phone?", "How much is the excess for an insurance claim?", "What does the device protection cost per month?"),
    ("a21", "Can I pay for a new phone monthly?", "Is there interest on phone instalments?", "What happens to the remaining phone payments if I leave?"),
    ("a22", "Can I trade in my old phone?", "How much will I get for my old iPhone?", "How long until I receive a quote for my used device?"),
    ("a23", "My phone was stolen, how do I block my SIM?", "I lost my phone yesterday, what should I do?", "Which number do I call to report a lost mobile?"),
    ("a24", "How do I switch to an eSIM?", "Will I keep my number with an eSIM?", "How do I order a new SIM card?"),
    ("a25", "How do I keep my number when moving to another operator?", "Where do I get my RIO code?", "Do I need to cancel my contract when porting my number?"),
    ("a26", "How do I update my postal address?", "Can I transfer my line to my partner's name?", "Where do I change my contact email?"),
    ("a27", "I forgot my password", "My account is locked after too many login attempts", "How do I reset my login?"),
    ("a28", "How do I set up my new internet box?", "Where is the Wi-Fi password of my router?", "How long does the router take to start the first time?"),
    ("a29", "I have no internet at home", "The light on my box is red", "How do I run a line test?"),
    ("a30", "My Wi-Fi does not reach the bedrooms upstairs", "Do you rent mesh extenders?", "Where should I place my router for the best signal?"),
    ("a31", "I'm moving house, what happens to my broadband?", "How early should I tell you about my new address for the internet?", "Is there a fee to transfer my fibre to a new home?"),
    ("a32", "How do I return my router after cancelling?", "What happens if I don't send back the box?", "Where do I get the prepaid return label?"),
    ("a33", "How do I cancel my contract?", "What notice period applies when I terminate a contract without commitment?", "I want to end my subscription"),
    ("a34", "Do I have to pay if I leave before the end of my 24 month commitment?", "Can I leave my minimum term early if I move abroad?", "What are the early termination fees?"),
    ("a35", "Why did my price go up?", "Can I cancel for free after a price increase?", "How much notice do you give before raising prices?"),
    ("a36", "How do I make a complaint?", "Who can I contact if my complaint is not resolved?", "Is the telecom mediator free?"),
]

articles = pd.DataFrame(_ARTICLES, columns=["article_id", "category", "title", "body"])
train = pd.DataFrame(
    [(f"q{i + 1:03d}", q[1], q[0]) for i, q in enumerate(_QUESTIONS)], columns=["question_id", "question", "article_id"]
)
_test_rows = [(q[0], text) for q in _QUESTIONS for text in q[2:]]
# A fixed shuffle so that test questions are not grouped by article.
_order = sorted(range(len(_test_rows)), key=lambda i: (i * 37) % len(_test_rows))
test = pd.DataFrame(
    [(f"t{n + 1:03d}", _test_rows[i][1]) for n, i in enumerate(_order)], columns=["question_id", "question"]
)
_y_hidden = [_test_rows[i][0] for i in _order]
_articles0, _train0, _test0 = articles.copy(), train.copy(), test.copy()

STOPWORDS = {
    "a", "an", "the", "i", "my", "me", "you", "your", "is", "are", "do", "does", "can", "how", "what", "when", "where",
    "why", "which", "who", "to", "of", "for", "in", "on", "at", "it", "if", "and", "or", "with", "from", "after", "be",
    "there", "this", "that", "will", "get", "have", "so", "much", "many", "long", "should", "need",
}

# Available in the notebook, like in a Kaggle notebook.
import numpy as np  # noqa: E402


def _score(submission):
    """Recall@3 of the submission on the hidden answers."""
    sub = submission.set_index("question_id").loc[_test0["question_id"]]
    top3 = sub[["top1", "top2", "top3"]].to_numpy()
    return float(np.mean([gold in row for gold, row in zip(_y_hidden, top3)]))


def _naive_submission():
    """Always the same three most generic articles."""
    return pd.DataFrame({"question_id": _test0["question_id"], "top1": "a01", "top2": "a33", "top3": "a06"})
