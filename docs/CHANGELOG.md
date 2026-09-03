# Changelog — user-visible changes per phase/release

## Mindoo's own users, and its leads on your B-Systems board (2026-09-03)

You said two things: *"mindoo user should appear in mindoo system not in
bsystems systems separate their users"* and *"mindoo leads should appear in
bsystems crm with a label called mindoo and the card being a light purple color
for the whole card to identify it."*

Both are done, and together they draw a clear line: **each company manages its
own people; you decide what you can see.**

### 1. Mindoo has a Users tab

**Mindoo → Users.** Add, edit, deactivate and delete Mindoo's people from inside
Mindoo. The only role it offers is Mindoo staff.

Your B-Systems Users list no longer shows a single Mindoo account, and Mindoo's
list shows none of yours. Neither side can edit, deactivate, delete — or sign in
as — the other's people. That last one matters most: "Open account" hands you a
live session as that person, so it stops at your own company's door.

Mindoo's Users page has no "Open account" button at all. It has one role, so
there is nobody to open.

### 2. Mindoo's leads are on your B-Systems board

Open **B-Systems → CRM** and Mindoo's leads sit in the columns beside yours,
**the whole card in Mindoo's purple with a MINDOO label** so you can tell them
apart at a glance.

Click one and it opens **read-only** — everything about the lead, nothing you
can change. That is on purpose: those leads are edited in Mindoo's own system,
and a button here that looked live but silently failed would be worse than no
button. So a Mindoo card has no drag handle, no Call, no WhatsApp, no "Ready to
close" — it is a window, not a workspace.

**Only you see them.** Internal sales, agents and partners see their own leads
exactly as before; another company's pipeline never appears for them.

### 3. The bug you reported

*"I can't add any users in bsystems right now"* — you were right, and it was
mine. When I added the Mindoo role to the user form the day before, its label
went into the wrong list, and a missing label does not show a blank box in this
app, it crashes the page. Adding users works again, and there is now a test that
checks every role on every form has a label, so this exact failure cannot come
back.

## Mindoo is its own system now (2026-09-02)

You said: *"I need to have the system for mindoo completly identical to
byteforce but with no partners or regestrations or agents or their crm at all…
I enter the creditials : admin@mindoo.com and password123… also remove the
switcher from bsystems system seperate them entirly nothing inside bsystems
goes to mindoo and vice versa."*

Done. Mindoo is no longer a segment on the B-Systems switch. It is a separate
system with its own address, its own colours and its own way in.

### 1. How you get in

**admin@mindoo.com / password123.**

The sign-in page is exactly as it was — it does not mention Mindoo, and it did
not need to: sign in with those credentials and the system opens on **Mindoo**,
in purple, with the Mindoo name on it. Sign in with your B-Systems account and
you get B-Systems, exactly as before. One door, two buildings.

### 2. The branding

Mindoo wears its own brand guideline throughout: **Deep Purple** as the anchor,
**Bright Purple** as the highlight, black headings and the cream page. Every
board column, badge, button and chart follows it. The Won column wears the
bright purple.

Two things are still waiting on you, and both are one file each:

- **The Monotalic font.** Headings are set in Montserrat for now, with Monotalic
  already named first in the stack. Send the font files and every heading in the
  system changes to it — nothing to rebuild.
- **The Mindoo logo.** The guideline's mark is a drawing rather than an image
  file, so the header currently shows the word **MINDOO** set in the brand font.
  Send a PNG or SVG and it drops straight in.

### 3. What is in it

**Home · To-Do · Calendar · Leads · CRM · Won Leads** — plus **Accounting** and
**the Data Vault** on the module switcher, exactly as B-Systems has them.

The CRM is the B-Systems one, as you chose: the same eight columns — New,
Following Up, Meeting Setting, Sending Proposals, Negotiation, Postpone / Not
answering, Won, Lost — the same forms behind each, and the same win with the
milestone tab feeding Won Leads.

The Home is the B-Systems dashboard **without the agent and partner figures**,
because Mindoo has neither and a panel that always reads zero is not a panel.

### 4. What is deliberately not in it

**Partners, Agents, Registrations, Statements, Payments** and the data-entry
page. Every one of those exists for external agents and partners. Mindoo has one
internal staff role, so those screens could never hold anything.

### 5. The two systems do not touch

- **The B-Systems switch is back to two:** B-Systems and ByteForce. Mindoo is
  not on it.
- **Your Mindoo login cannot open B-Systems**, and your B-Systems login cannot
  open Mindoo. Both are refused at the door, not hidden in the menu.
- **Accounting shows Mindoo one company: Mindoo.** Your B-Systems accounting
  still shows exactly the two tabs it always did — ByteForce and B-Systems — and
  never Mindoo. Neither can see the other's income, expenses, treasury, loans,
  payroll or targets.
- **The Data Vault is the same.** Mindoo's forms, links, sheets, documents,
  tasks and employees are Mindoo's; everything already in the vault stays with
  B-Systems and ByteForce, including the records that were never tagged with a
  company.
- **Your export files are unchanged.** "Export all companies" from your
  B-Systems accounting gives you the same two-company file it always has.

### 6. Things that were broken and are now fixed

When Mindoo was a segment on the switch, its board looked complete but **nothing
you did on it saved** — dragging a card, marking a lead ready to close, the
didn't-answer counter, adding or editing a lead, ticking a milestone, uploading
a contract. Every one of those was quietly being sent to B-Systems' side of the
system and refused there. All of it works now, and there is a test that presses
the button and checks the answer rather than just looking at the screen.

I then had the whole change reviewed line by line before calling it done, and
that turned up more. The ones you would have noticed:

- **Mindoo's To-Do and Calendar rows would have logged you out.** Every row
  linked into the B-Systems side, which your Mindoo login is not allowed to
  open — so clicking your own work signed you out. Fixed, and there is now one
  place in the code that decides where a lead lives, so it cannot happen again
  for a fourth company.
- **Delete on a Mindoo lead did nothing.** The button was there, asked you to
  confirm, and then failed silently. It works.
- **A contract you uploaded to a Mindoo won deal could not be opened again.**
  Upload succeeded; the link beside it was refused. Fixed — and the same file
  is now correctly refused to the B-Systems side.
- **"Ready to close" on a Mindoo lead sent a phone notification to B-Systems.**
  The lead's name went to every B-Systems admin's bell and phone, and no Mindoo
  account could see it at all. That notification is Mindoo's business only, so
  it is no longer sent outside it.
- **The Data Vault's "Recent activity" list showed everyone everything.** Every
  other list on that page was already separated by company; that one was not, so
  it printed lines like "Mona archived Q4 Contract" to a company that cannot see
  the record. Separated.
- **Renaming a link category renamed other companies' links too.** Typing
  "Portfolio" over "portfolio" in one company silently re-spelled the same word
  on the other company's records. It now stops at your own.
- **Accounting could show one company's money under another company's logo.**
  Reachable by editing the address bar: the figures were right and the colours
  and the mark on top of them were somebody else's. Fixed.
- **Mindoo's board offered B-Systems' sales reps** in the "assign a rep" list,
  and the call sheet hid negotiation notes that Mindoo's own staff had written.
  Both corrected.


## Mindoo — a third company, on the same switch (2026-09-01)

You said: *"We need to add a third CRM called Mindoo with the exact same switch
mechanic and the exact same info and details."*

Done. **Mindoo** is now the third segment on the company switch, beside
B-Systems and ByteForce. Click it and every board, list and number changes to
Mindoo's — same as switching to ByteForce always has.

### 1. It is a copy of B-Systems

You chose B-Systems as the one to copy, so Mindoo has **the same eight columns**
— New, Following Up, Meeting Setting, Sending Proposals, **Negotiation**,
Postpone / Not answering, Won, Lost — the same forms behind each of them, the
same follow-up and meeting records, and the same win: the milestone tab with the
value, the commission percentage and dated milestones, feeding **Won Leads**.

ByteForce is unchanged and still has no Negotiation column. The two pipelines
stay two pipelines; Mindoo simply runs the same one B-Systems does.

### 2. Its sections

**Home · To-Do · Calendar · Leads · CRM · Won Leads.** The To-Do shows Mindoo's
own dated work; the Calendar shows Mindoo's meetings and its people's time,
under exactly the same busy-block rule as the others.

What Mindoo does **not** have is the Partners & Agents side — Partners, Agents,
Registrations, Statements, Payments. Those exist for external agents and
partners, and you asked for Mindoo to have one staff role rather than the agent
network. Say the word if that changes and it becomes its own piece of work.

### 3. Who gets in

There is one Mindoo role. Anyone holding it sees every Mindoo lead and can do
everything inside Mindoo — including closing a deal.

**Your account holds all three companies**, so you get a three-way switch. A
Mindoo-only teammate gets **no switch at all** and cannot reach B-Systems or
ByteForce, in either direction — exactly the rule that has always applied
between the first two.

Seeded for you: **mona@mindoo.example / mindoo123** is a Mindoo-only teammate,
and there are five Mindoo leads spread across the pipeline (one of them sitting
in Negotiation) so the board, the counts and the To-Do have something real in
them.

### 4. What it looks like

Nothing changes. Your own rule from the merge — *"I don't need the entire
interface to change"* — still holds: the shell stays exactly as it is whichever
company you switch to. Mindoo needs no logo or colours to work. If you want it
to have its own later, drop the guidelines in and they'll be wired the way the
other two were.

Mindoo keeps no books and no vault records for now, so Accounting and the Data
Vault still show two companies.

---

## Postpone / Not answering — a shelf for the leads that go quiet (2026-08-31)

You said: *"We need a column in the CRM called Postpone / Not answering, for all
the leads that are falling out of the CRM — not answering, not attending the
meeting, no showing. When we move the lead there, the popup will be: is he not
answering at all, or is he no show in the meeting, or is he not interested right
now at all? Those are the three options, and there is Other, written by the
user."*

Done. It is on **both** boards — B-Systems and ByteForce — sitting just before
Won and Lost.

### 1. Moving a lead there always asks why

Pick **Postpone / Not answering** as the next action, or drag the card into the
column, and you get exactly the popup you described:

- **Not answering at all**
- **No show at the meeting**
- **Not interested right now**
- **Other** — and this one makes you write the reason. The other three don't;
  a no-show is already said by its name. You can still add a note to any of them
  if you want to.

You can't move a lead there without answering. That's on purpose — a column you
can drop leads into without saying why is a place leads disappear, not a list you
can work back through.

### 2. It is a shelf, not a graveyard

This is the important part, and it is what makes it different from Lost. **A
postponed lead is still live.** It comes straight back out to Following Up, or
Meeting Setting, or anywhere else — same as any other column. Nothing is
archived, nothing is closed.

And the reason it was parked **stays on the record**. Bring a lead back and the
history still shows "Postponed — Not answering at all", with the date. Park it
again six weeks later and you get both, in order. So "he went quiet twice before
he bought" is a thing you can actually see.

### 3. The "Didn't answer" counter is untouched

You already have the button that counts how many times you tried. It still
counts, and — this is the bit worth knowing — **parking a lead no longer wipes
it.**

Everywhere else in the system, moving a card means you reached the client, so
the counter resets. Moving a card into *Not answering* obviously means the
opposite. If you tried five times and then shelved him, the board still says
five. The two answer different questions: the counter is how many times you
tried, the column is where he went when you stopped for now.

### 4. Reaching it from a meeting that didn't happen

Since "no show" is one of your three reasons, the meeting outcome now offers it
directly: mark a meeting **Cancelled** and *Postpone / Not answering* is one of
the places you can send the lead, next to Following Up and Lost. Marking a
meeting **Attended** does not offer it — attending is the opposite of what the
column means.

### 5. Everywhere else

The column has its own colour — a hold amber, not the grey of Lost, so a paused
lead never reads as a dead one at a glance. It counts on the dashboard's
per-stage numbers like every other column. It reads in Arabic (**تأجيل / لا
يرد**) and mirrors right-to-left. And a postponed lead drops off your To-Do,
because there is nothing you owe it today.

---

## The Calendar — every meeting, and everyone's own time, on one month (2026-08-31)

You said: *"The calendar is a new page which takes all the meetings from the
meeting settings in the CRM and puts them in a calendar, with the ability for
every single user to add their own schedule on it. So whenever X is setting a
meeting and Y has to be in this meeting, X will look at the calendar and see if
Y has any other meetings other than the CRM — personal stuff, another offline
meeting or something."*

Done. **Calendar** is in the menu, right after To-Do, for both companies.

### 1. The CRM's meetings arrive on their own

Every meeting you have marked **arranged** in Meeting Setting is already on the
grid — you do not add it, copy it, or keep it in step. Change the date on the
board and the calendar has changed. It shows the client's name, the time, and
whether it is online or in person, and clicking it opens the lead.

A meeting that is only a *proposed* slot (arranged not ticked) stays off: it is
not yet a commitment, and it should not make anybody look busy.

### 2. Your own time goes on it too

**Add to my calendar** takes a name, a day, a time — or tick **All day** — an
optional end, and a note. A supplier meeting, a trip, a doctor's appointment.
Yours to edit and yours to delete, from the day panel under the grid.

### 3. What everybody else sees — and this is the part to read

Your entries are **private by default**. A colleague looking at your day sees a
grey hatched block that says **Busy · your name** and the time. Not what it is.
Not the client. Nothing.

That is deliberate, and it is what makes the whole page safe to open to
everyone: **the calendar shows you nothing you could not already see.** The
meetings you can read in full are exactly the ones you can already open in the
CRM — your own, if you are an agent or a partner; the internal ones, if you are
sales; all of them, if you are an admin. Everything else, from either company's
side of the wall, is just a busy block. An agent still cannot read another
agent's client list, on this page or any other.

So when you check whether Y is free on Thursday, you get the answer — *he is
taken from two to three* — and only the answer.

If you WANT the team to know what something is, tick **"Let the team see what
this is"** on that entry. Then they read the name — *"Supplier visit —
Alexandria"* — and still not your private note, which never leaves your own
screen.

### 4. "Also blocks" — so Y really shows as busy

This is the piece that makes your example work. When you set a meeting, the
Meeting Setting form now has **Also blocks**: tick whoever has to be in it.
Their calendar shows the time as taken from that moment, even though the lead is
yours and not theirs.

Without it a meeting could only ever block the lead's owner — so the one person
you actually needed to check on would have looked free.

### 5. Moving around it

- **‹ Today ›** — one month back, one forward, or straight back to this month.
  The month is in the address, so you can bookmark a month or send someone a
  link to it.
- **Everyone / one person** — narrow the grid to one person's time. It matches
  on *whose time it is*, so a meeting you booked that blocks Y appears under Y.
- **Click any day** to open it underneath, listing everything on it with the
  full times, who is on it, and the way through to the lead.
- Today is marked. Friday and Saturday are tinted as the weekend, and the week
  starts on Sunday, the way the working week runs here.

Everything is in both languages and reads right-to-left in Arabic, and the
twelve-hour clock is the same one as the rest of the system.

---

## The Vault gets a Links section — stop hunting for the same links (2026-08-29)

You said: *"The Vault is split into sections — Sheets, Forms, Archive and
others. I want a new section for saving the important, repeated links we keep
needing to find again: a portfolio, a content calendar, a video we use over and
over, a Google Drive folder or Sheet, a document, an image, a website, a
reference, or any other URL… so the Vault is not only a place for Sheets, Forms
and Archive, but also a central place to keep any important or repeated
resources and links we use constantly, instead of hunting for them every
time."*

Done. It is in the Vault's menu, right after Forms.

### 1. Saving one takes five boxes

Press **+ Add link** and you get exactly what you asked for:

- **Name** — "ByteForce Portfolio".
- **URL** — the link itself.
- **Company** — ByteForce or B-Systems.
- **Category** — your eight are already in the box as suggestions (Portfolio,
  Content Calendar, Reference, Social Media, Marketing, Project, Assets,
  Other). **Click one, or ignore all eight and type your own** — "Investor Deck
  Q4", anything. What you type is what gets saved, in your words, and it joins
  the suggestions and the filter from then on.
  Two small things about categories that should never surprise you. Picking
  **Portfolio** in English and **بورتفوليو** in Arabic files both links under
  **one** category, not two — those are our words for the same shelf, and
  splitting your links across two spellings of it is exactly what we are trying
  to stop. And **a category can be re-spelled**: if you filed something as
  "investor deck q4" and want it written properly, edit any link in it and fix
  the spelling — the whole category follows, including the archived ones.
- **Type** — what is behind the link: Video, Image, Document, Sheet, Form,
  Folder, Website, Other.

There is a Notes box too, if you want to leave yourself a sentence about why
this one matters.

### 2. The row reads the way you wrote it

**Name — Company — Category — Type — Open link.** Press **Open link** and it
opens in a new tab; the Vault stays exactly where it was behind it.

Under every name there is the site it actually goes to — `drive.google.com`,
`youtube.com` — so you can see where a link points **before** you press it.
That matters most for the ones you saved six months ago.

**Edit** is beside every row, so a name or a category can be fixed in place.

### 3. About "Delete" — please read this one

You wrote **Delete**. In the Vault, nothing has ever been deleted: everything is
**archived** instead, and Archive is one of the sections you listed yourself. So
the button on a link says **Archive**, and it does what it does everywhere else
here — the link leaves the list and the counts immediately, and you find it in
the **Archive** tab under its own **Links** heading, where one click brings it
back with everything intact. The Undo button also covers it, like every other
archive.

**If you meant gone for good — really gone, no way back — say the word and we
will build that separately.** We did not want to destroy anything you saved on
a guess.

### 4. Fifty links stay usable

The point of the section is that you stop hunting, so it does not just pile up:

- a **search box** that reaches the name, your category, the notes and the
  address itself
- filters for **company**, **category** and **type**, which combine — "every
  B-Systems video", "everything filed under Portfolio"
- the category filter only ever offers categories you have actually used
- a **Clear** button that appears the moment something is filtered
- and when a filter matches nothing it says *"No links match these filters"* —
  not "no links yet", because those are two different things

Links also show up in the Vault's own search box on the overview, and in the
counts at the top of it.

### 5. Two things we were careful about

- **Only real web addresses are accepted** — `http` and `https`. A link
  pretending to be an address but carrying something else is refused by the
  server, not just by the form, so nothing dangerous can ever be saved and
  clicked from inside the Vault. Every link opens in its own tab and cannot
  reach back into the system. And if an address ever *does* get into the table
  by another road — restoring an old backup file, say — the row shows it as
  **not openable** rather than handing you something to click.
- **Your categories are yours.** The eight suggestions are translated when you
  switch to Arabic, because they are our words. Anything **you** type is printed
  exactly as you typed it, in both languages — we will not translate "Investor
  Deck Q4" and we will not guess. A category you write in Arabic stays Arabic on
  the English screen, which is the honest answer.

### 6. Named "Links"

You offered **Links** or **Resources**. We went with **Links** because every row
in there is a URL, so the name says exactly what is inside. If **Resources**
reads better to you, it is a one-word change — say so and it is renamed
everywhere.

## The WhatsApp button turns green once we have messaged them (2026-08-29)

You said: *"when I click on the WhatsApp button, it should turn to be green to
signal that I already sent WhatsApp to that prospect or to that lead, and it
signals not just for my user, for any user that we have contacted this lead
through WhatsApp. So it turns green or something. Just change its color. If it's
not green right now, turn it green to signal that we did our due diligence and
sent them WhatsApp message."*

Done.

### 1. Press it once, and it is green for everybody

- **The WhatsApp button goes green the moment you press it** — instantly, before
  anything is saved, so you get the signal at the speed of the press.
- **It is green for the whole team, not just for you.** Whoever opens that lead
  next — on another account, on another phone, in the other company — sees the
  same green. That was the part you asked for twice, so it is the part the
  system now guarantees.
- **It stays green.** Moving the card to another column does not clear it,
  archiving does not clear it, and nothing un-presses it. It is a record that we
  did the work.

### 2. It says who and when, not just a colour

- Hover it, or read it with a screen reader, and it says **"WhatsApp sent by
  Omar on 3 Sep 2026"** — the person who first messaged them and the day. In
  Arabic it says the same thing in Arabic.
- On the **call sheet** — the page you get when you dial, the one you actually
  use on your phone — that sentence is **printed under the button in plain
  words**, because a hover tooltip is not something a phone can show you.
- There is a **✓** on the button too, so it never depends on you seeing a colour.
- **The first message is the one that is kept.** If you press it after Omar
  already did, it still says Omar — you did not take the credit off him by
  opening the card. Every press is still written into the card's History, so you
  can always see who has messaged them, and how often.

### 3. Green everywhere the button is

Same button, same green, on every screen it appears:

- the **CRM board cards**, under both companies
- the **lead page**
- the **call sheet** you get when you dial
- the **Partners & Agents board cards** and the **partner/agent page**
- the **partner directory** and the **Agents list**

Marking a partner on the board shows green on their directory page, and the
other way round — it is one record, so it is one answer.

### 4. The button still just opens WhatsApp

This is the part that mattered most to get right. **Pressing it never waits for
anything.** WhatsApp opens exactly as fast as it always did; the green mark is
saved quietly in the background, and if the connection is bad it is simply not
saved — you still get your message window, and you never get an error. A missed
mark you can press again; a WhatsApp button that hesitates would be worse than
no mark at all.

### 5. Pressing it changes nothing else on the card

- **Your Undo still works.** Flagging a lead as "didn't answer" and then
  messaging them on WhatsApp used to leave the Undo button pointing at something
  it could no longer undo. Pressing WhatsApp now leaves the card exactly where it
  was, so Undo still does what it says.
- **Your board does not reshuffle.** The card stays in its place in the column
  instead of jumping to the top because someone opened WhatsApp.
- On a partner or agent page, where the button appears **more than once** (at the
  top and beside each number), pressing one turns all of them green at once.

### 6. About the green

Green has been banned everywhere in this system except the accounting screens —
that was a decision you made earlier, and it is still in force. You asked for
green here explicitly, so this is now a second, deliberate exception with its own
name, written down beside the first one, and used by nothing except this button.
It is the same green the accounting screens use, so the product still has exactly
one green, and it is dark enough to read cleanly in both companies' colours.

### Two things to tell us

- **There is no way to un-green it.** Removing the mark would quietly erase the
  proof you asked for, so we did not build a button that does it. If you want one
  — for a mis-click or a wrong number — say so and we will add it with a record
  of who removed it.
- **An agent who signed themselves up through the public form has no card on the
  Partners & Agents board**, so there is nothing for their WhatsApp button in the
  Agents list to mark; it stays a plain link. Every agent you added from the board
  is marked normally. Tell us if you want the sign-ups covered too.

## One CRM, one switch — plus a twelve-hour clock and the answer you are waiting for (2026-08-29)

You said: *"I need to completely merge the systems and byte force CRMs, and I
want the switching to be inside the CRM… I just want the b systems CRM. I can
have a switch button between b systems and byte force, and the entire boards
change accordingly. The same thing with the to do… make sure that this is there,
and there is no confusion in it."*

And, minutes later: *"Also, use the twelve hour timing, not the twenty four hour
timing. And this is through the entire system."* And: *"Make sure that the
response date is made in the to do list as see their response or check their
response or check with them in the negotiations."*

All of it is in.

### 1. There is one CRM now, and a switch inside it

- **The ByteForce app is gone as a separate place to go.** There is one CRM, the
  B-Systems one, and a **Company** switch inside it that says in words which
  company you are looking at — **B-Systems** or **ByteForce** — with the current
  one filled in, never colour alone.
- **Everything follows the switch.** Not just the board and the To-Do: the Home
  figures, the Leads screen, the lead pages, the call sheet — every screen shows
  the company you are switched to.
- **The screen never changes shape when you switch.** Same header, same colours,
  same logo, same everything. Only the work changes. That is what you asked for:
  *"we don't have the entire page for byte force… I don't need that."*
- **The menu changes with the company**, so you never see a link that leads
  nowhere. Under ByteForce you get Home, To-Do, Leads, CRM and **Clients**. Under
  B-Systems you get your full list including **Won Leads**, Partners & Agents,
  Registrations, Statements and Users. Clients and Won Leads stay two separate
  screens, because they are two different things — Clients has your collected and
  to-be-collected money, Won Leads has commissions and milestones.
- **The company stays with you as you move.** Open the ByteForce board, click
  Leads, click To-Do, open a lead — still ByteForce. Use the search or a filter
  and it is still ByteForce; the filter no longer throws you back to the other
  company, which was the single most likely way this could have confused you.
- **The address says which company it is**, so a link you send someone opens on
  the same company you were looking at. Two people at the same address always see
  the same thing.
- **Every old ByteForce link still works.** Bookmarks, and the notifications
  already sitting on your phone, land on the right screen with ByteForce already
  selected. Nothing 404s.
- **Filters do NOT follow you across a switch**, on purpose. A B-Systems owner
  filter means nothing on the ByteForce board, and a board that looks filtered
  but is not is worse than a clean one.

### 2. Nobody can see anything he could not see yesterday

- **Somebody who only works on ByteForce is simply locked to ByteForce.** He logs
  into the same one CRM, sees only ByteForce work, and is shown **no switch at
  all** — not a greyed-out one, not one hidden in a menu.
- **The same the other way.** Sales, agents, partners and the data-entry account
  are locked to B-Systems, with no switch.
- **You see the switch** because you hold both.
- **Typing the other company into the address bar does not work.** The refusal
  is on the server, on every screen and every save — not hidden in the buttons.
  Ask for a company you do not hold and you land back on your own, without an
  error page and without a stack trace.

### 3. The whole system tells the time the way you read it

- **Every time in the product now reads 2:30 PM instead of 14:30** — the board
  cards, the To-Do rows, a lead's history, the call sheet, the vault, the
  registrations list, the lead chat, and the meeting notification that arrives on
  your phone.
- **In Arabic it reads properly in Arabic**: **20 أغسطس 2026، 6:30 م**. The
  morning/evening marker is the Arabic one (ص / م), never a latin AM/PM, and the
  numbers stay the ones you use everywhere else in the system.
  - **This also changed the DATE in Arabic** — the month is now written in
    Arabic. That was forced rather than chosen: an Arabic marker stuck on an
    English date comes out backwards on a right-to-left page, with the "م"
    floating off next to the date instead of the time. Tell us if you would
    rather have it another way.
- **The time you TYPE has not changed.** The little time picker is your phone's
  or your computer's, and it keeps working exactly as it did.
- **Nothing about days moved.** Today is still today, follow-ups still land on
  the day you chose, and the summer/winter clock change is still handled the same
  way. Only what you READ changed.
- **A follow-up with no time is still just a date.** The clock only shows when
  somebody actually chose one — that has not changed.
- **Older notifications keep the old text.** A notification sent before today
  still says 14:00, because it is a record of what was sent. New ones read 2:00
  PM.

### 4. The answer you are waiting for stops looking like another call

- **The response date you promise in Negotiation now has its own line on the
  To-Do**, labelled **"Check their response"** — **التحقق من ردّهم** in Arabic —
  instead of sitting there looking like every other "Follow-up".
- **One glance separates the two**: the calls you owe, and the answers you are
  waiting on.
- **It behaves exactly like every other task.** Tick it off and it moves to Done;
  untick it and it comes back. It only shows on the day it is due, and only the
  people who could already see that lead can see or tick it.
- **It keeps its name after the deal moves.** They answer, you mark the deal Won
  or Lost the same afternoon — and the Done line still says "Check their
  response", because that is what today's job actually was.
- **ByteForce does not have it**, because ByteForce has no negotiation stage.

## Accounting and the Data Vault can be taken away from one admin at a time (2026-08-26)
- You said: *"I want to have the ability to block some admins from acsessing
  accounting or data vault."*

### One tick each, per person
- **Users has a new box called Modules**, sitting right under the access boxes:
  **Accounting** and **Data Vault**. It appears the moment you tick "B-Systems
  admin" and not before, because for anybody else the two ticks would mean
  nothing — nobody but an admin has ever been able to open either module, and
  that has not changed.
- **The two are completely independent.** Take Accounting away from someone and
  his Data Vault is exactly where he left it, and the other way round.
- **A new admin arrives with both**, and so did everybody who already exists.
  Nobody lost anything the moment this went live — you have to take it away on
  purpose.

### You can see who is blocked at a glance
- **The person's row says it out loud** — "No Accounting", "No Data Vault" —
  beside their access badges. You do not have to open anybody to find out.

### What a blocked admin experiences
- **The button is simply not there.** ACCOUNTING or VAULT disappears from the
  switcher at the top of the screen, from the strip under the header on a phone,
  and from the menu behind the burger. He is not shown a door that will not open.
- **If he types the address anyway, he gets a straight answer**, not a blank
  screen and not a bounce back to where he started: a page that names the module,
  says an admin can switch it back on from Users, adds that nothing else about
  his account changed, and gives him a link back to his own dashboard. It reads
  the same in Arabic.
- **Everything else is untouched.** His leads, his boards, his To-Do, Users,
  Statements, the other module — all exactly as they were. This is one switch,
  not a demotion.

### It takes effect immediately, and it cannot be worked around
- **The moment you save, he is out.** He does not have to sign out and back in;
  his very next click is refused. Give it back and he is in again just as fast.
- **Hiding the button is not the lock.** Every single page and every single
  request inside both modules asks the question again on the server before it
  answers — forty of them, and a test now reads the folder itself so a page
  added next month cannot quietly skip the check.
- **Opening someone's account "as them" shows THEIR access, not yours.** If you
  open the account of an admin who is blocked from the vault, you are blocked
  from the vault too, until you snap back.

### One thing you cannot do
- **You cannot take a module away from your own account.** The two ticks are
  locked on your own row, with the reason written under them. Any other admin
  can do it for you, and give it back — but nobody can lock himself out of the
  thing he is standing in front of configuring.

## The bell marks what you have not read, and the saved app can ring your phone (2026-08-25)
- You said: *"make a distict mark or a color for the un opened notifications"* —
  and *"also I want the website to sent actual notification so I installed the
  website as an app on my phone I want it to shoot me actual notifications."*

### What you have not opened now looks different
- **A new notification wears a mark of its own.** It sits in a tinted strip,
  with a coloured bar down its edge and a dot in the same colour as the number
  on the bell, and its headline is bolder. Open it and all of that goes quietly
  away. Before today the only signal was that the ones you HAD opened looked a
  little faded — which tells you nothing at all on a morning when everything is
  new.
- **It works the same in both apps and in Arabic.** Orange in ByteForce, the
  B-Systems pink in B-Systems — the same colour the count on the bell already
  uses, so the "3" and the three marked rows read as one thing. In Arabic the
  bar moves to the right-hand edge by itself.
- **The bell itself is unchanged.** The count, the tap-through to the lead, the
  refresh every few seconds: all exactly as they were.

### Your phone can now ring for real
- **There is one new button, at the bottom of the bell: "Turn on phone
  notifications."** Press it, say yes when your phone asks, and from then on
  anything that lights the bell also arrives on your lock screen.
- **Everything that already notifies you, notifies your phone.** A lead assigned
  to you. Someone mentioning you in a lead's chat. A meeting request. A lead
  marked ready to close. A new agent registration. A lead typed in by data entry
  that still needs an owner. Nothing was left out, and anything we add later is
  included automatically.
- **Tapping it opens that exact lead**, in the right app — and in the window you
  already have open rather than stacking up new ones.
- **It only ever tells you what the bell already told you.** A notification on
  your phone carries its headline and its one line of text and nothing else. No
  figure, no client detail, nothing about a lead that you could not already read
  on the screen. That rule also means nobody can be pushed news they are not
  allowed to see: the phone follows exactly the same permissions as the bell.
- **Every device is its own switch.** Turn it on for your phone and leave your
  laptop quiet, or have both. Turn it off from the same place. If a phone is
  wiped or the app deleted, we notice on the next send and quietly forget it, so
  nothing keeps trying to reach a device that is gone.
- **It tells you the truth instead of pretending.** If your browser is blocking
  us it says so and where to change it. If you open the site in Safari on an
  iPhone instead of the app you saved to your Home Screen, it says that too, in
  one sentence — because on an iPhone notifications only ever work from the
  saved app. If you close the permission box without choosing, it says so and
  waits for you to press again.
- **What you must do to switch it on.** Two keys have to be set on the server
  first (they are with the deployment notes). Until they are, the button does
  not appear at all and the app is exactly what it was this morning — nothing
  to break, nothing to undo. Once they are set: open the app from your Home
  Screen, tap the bell, tap **Turn on phone notifications**, and tap **Allow**
  when iPhone asks. That is the whole thing, and it is per device.


## Partners and agents on one set of columns, with a Waiting stage (2026-08-21)
- You said: *"Add a new stage called Waiting. Order: Meeting Setting then
  Waiting then Qualified. Leads in Waiting must remain fully editable at any
  time."* — and, when we asked whether the two kinds of card should keep
  separate columns: *"Same stages for both."*
- **One board, seven columns, both kinds of card.** Lead · Contacted · Didn't
  Answer · Meeting Setting · Waiting · Qualified · Lost. Partners and agents sit
  on the same board again, each card still showing whether it is a partner or an
  agent. The two stacked boards are gone — on a phone that is half the scrolling
  it was yesterday. The Kind filter still works; it just hides the cards you did
  not ask for instead of taking a whole board away.
- **Waiting is a real column, not a dead end.** Nothing is asked of you to put a
  card there. A card in Waiting is fully editable — you can change anything on
  it, add numbers to it, record a follow-up on it — and it moves out again in
  both directions: forward to Qualified, or back to the meeting, to Contacted,
  or all the way to Lead.
- **Contacted asks you for nothing.** You said: *"The system should not require
  any additional details or mandatory fields when moving a lead to Contacted."*
  Drag it or choose it, partner or agent — it just moves. No date, no method,
  no form.
- **Qualified never asks for an email or a password again.** A partner still has
  to be complete before he joins the directory — company, key person, role,
  address, number, activity, importance — but the password box is gone from that
  step entirely, and the email is optional as it always was. An agent is simply
  qualified: nothing is created, nothing is demanded.
- **Creating his login is now a button you press when you are ready.** On a card
  that has reached Qualified you will see **Create the agent's account** (or
  **Create the partner's login**) next to Edit. It asks for exactly what it
  needs — his name, phone, email, the password you choose for him, his speciality
  and address — and creates his account there and then: he signs in immediately,
  his CV moves onto his profile, and you can assign him leads. It refuses to run
  twice, and it refuses if that email or phone already belongs to somebody.
- **A qualified agent without a login is a normal thing now, so the screen says
  so.** His card reads **No login yet**, his page reads *"Qualified, no account
  yet — create their login when you are ready."* No guessing whether the account
  exists. A qualified PARTNER whose login you have not created yet says the same
  thing on his card: "Converted" only ever meant he is in the directory, and
  since the password box left the Qualified step it no longer means he can sign
  in. The button that creates the login stays on the card's own page.
- **Contacted is no longer a task on your To-Do.** You said: *"Contacted should
  only indicate that contact has been made unless an actual Follow Up task is
  required."* It does exactly that now. A card only appears on the To-Do as a
  follow-up when somebody actually recorded one — and you can record one from
  any active column with **Record a follow-up**, which leaves the card exactly
  where it is. If you record one, it shows up: from Lead, from Contacted, from
  Waiting, from the meeting column, and from Didn't Answer too — the record is
  what puts it there, never the column it happens to be sitting in. And
  recording a call on a card that already has a meeting booked no longer takes
  the meeting off the list: both dates are things you owe somebody, so you now
  see both.
- **Your existing cards moved themselves.** Every partner card that was in
  Following Up is now in Contacted, and every one that was Won is now Qualified,
  with its history, its directory record, its leads and everything hanging off it
  untouched. Nothing was lost and nothing was created.

## Two ways to change someone's pay — and they finally do different things (2026-08-21)
- You said: *"when I edit an expense of the type of payroll and it is being
  edited it doesn't automatically edit in the actual payroll roster because it
  can be because of a deduction or something."*
- **It should not edit the roster — and now there is a proper way to do what you
  actually want.** A salary line on Expenses now gives you two buttons, and they
  mean two different things:
  - **Edit in roster** — changes his salary **from this month forward**. This
    month, next month, every month after. That is a raise or a pay cut.
  - **Adjust this month only** — changes **only this month**. A deduction for
    days missed, a bonus for a good month. His salary on the roster does not
    move, and no other month moves. Next month he is back to normal on his own.
- **Deductions and bonuses can finally be typed in.** Choose Payroll on an
  expense and two optional boxes appear under the amount: Deduction (EGP) and
  Bonus (EGP). Until now the only way a deduction could get into the books was
  by importing your old file — the form never had a place for one, not here and
  not in the old app either.
- **"Adjust this month only" fills the form in for you.** The person, his
  department, the month, and his salary as the starting amount. You type the
  deduction or the bonus and save. The form tells you, by his name and the
  month, that you are changing that one month and nothing else.
- **The row shows its working.** The big number stays what actually leaves the
  account, and underneath it, quietly: *Base EGP 5,000 − deduction EGP 200*. No
  more a salary line that disagrees with his salary and will not say why.
- **Approved stays approved.** If you had already ticked his salary as paid and
  then adjust the month, it stays ticked — the "Paid this month" figure moves by
  the 200 you deducted, not by his whole salary. And if you delete the
  adjustment, his normal salary line comes back **still ticked**, with the date
  you approved it on. Nothing quietly un-approves itself, in either direction.
- **Changed your mind? Delete it.** The adjustment is an ordinary row with Edit
  and Delete. Delete it and his salary line comes straight back from the roster,
  full amount, that month only.
- **A typo cannot invent money.** If you type a deduction bigger than the salary
  plus the bonus, the system refuses it and tells you why. A salary line that
  goes below zero is not a cheaper month — it would quietly ADD cash to the
  treasury. The same check now guards your IMPORTED file: if an old line has a
  deduction bigger than the salary, the import stops and names the line instead
  of quietly adding money to your books. Nothing is replaced until you fix it.
- **Nobody can be paid twice for the same month.** If a person already has a
  payroll line for a month, adding a second one is refused and the message tells
  you which row to edit. (The "Extra payroll (adds on top)" option is different
  and still there — that one is a bonus payment on top of a salary, not a
  replacement for it.)
- **Only you can un-tick an approval.** Ticking is yours to give and to take
  back: the ✓ on the row, or setting Status to On hold. Adding an adjustment,
  moving one to a different month, or moving it to a different person never
  takes an approval away by itself — and when the adjustment goes, the salary
  line comes back exactly as approved as you left it, on the date you approved
  it, not the date you typed the adjustment.
- **The adjustment form fixes the person and the month.** They are shown but not
  editable, because they are what the message at the top of the form promises.
  To adjust a different month or a different person, open that row.
- **Everything downstream already counts the real number.** The dashboard, the
  monthly P&L, the department margins, the treasury and accounts payable all use
  the amount after the deduction or bonus — so a deduction genuinely lowers the
  month, and a bonus genuinely raises it.
- **Leave a box empty and it means empty**, not zero — so the file you export
  for the old app keeps exactly the shape it expects.

## The ✓ on an accounting row goes green when the row is settled (2026-08-21)
- You clicked the right sign and said it should turn green. It does now, and it
  **stays** green for as long as the row is settled — so the buttons column on
  its own tells you which rows are approved, without reading across to the
  status pill.
- **Green means settled.** On Income a green ✓ is *Collected*; on Expenses it is
  *Paid*. A normal-coloured ✓ means the row is still Pending / On hold.
- **Click a green ✓ and it goes back to normal — and the row goes back with it**,
  to On hold on Expenses and to Pending on Income. Same button, both directions,
  nothing else to click.
- It works on **the salary lines that come from the Payroll Roster** too — the
  rows whose only other button is "Edit in roster", the ones in your screenshot.
- It is **the same green as the Collected / Paid pill** already sitting on the
  row, in both companies' books: ByteForce accounting and B-Systems accounting
  look identical here on purpose.
- The button does not change size when it flips, so the row of buttons never
  shifts under your finger.
- **Colour is not the only thing that changed.** Hover the ✓ on Income and it
  now says what your click will do — "Mark collected" on a pending row, "Mark
  pending" on a collected one — where before it always said the same thing.
  Expenses already did that ("Approve / mark paid" / "Mark on hold") and still
  does. Both are written in Arabic too, and a screen reader now announces the
  button as "Collected" (or "Paid") **pressed** or **not pressed**.
- **A ✓ that cannot go through now says so.** If a click fails — your session
  expired, or someone deleted the row in another tab — the reason appears beside
  the buttons instead of the row simply not moving. And the ✓ ignores a second
  click until the first one has landed, so an impatient double click can no
  longer undo itself.
- **One thing to expect on Income:** a collected invoice is listed both under
  the month it belongs to and under the month its money arrived. If you un-tick
  a green ✓ while looking at the month the money arrived in, the money is gone
  from that month — so the row leaves it and goes back to its own month as
  Pending. That is the books being right; nothing is lost.

## Agents get their own columns (2026-08-20)
- You asked for it, so agents now walk their own board: **Lead · Contacted ·
  Didn't Answer · Meeting Setting · Qualified · Lost**, in that order.
- **Qualified is where an agent becomes an agent.** Drop a card there (or pick
  it from Next action) and the same form you already know asks for his details
  and the email and password YOU choose — and the account is made on the spot.
  He signs in straight away; there is no request waiting for approval. The card
  stays in Qualified with the **Converted** badge, exactly like a won partner
  stays in Won.
- **Partners have not changed at all.** Lead, Didn't Answer, Following Up,
  Meeting Setting, Won, Lost — same columns, same Won step, same everything.
- **The board shows you the columns that belong to the card.** Filter to
  Partners and you get the partner columns; filter to Agents and you get the
  agent ones. With no filter — how the page opens — you get **both boards, one
  under the other**: Partners on top, Agents below, each with its own columns.
  A card can only be dropped on its own board; dragging one across does
  nothing at all.
- **Nothing you already had was left behind.** Agent cards that were sitting in
  Following Up have moved to Contacted, and agent cards in Won have moved to
  Qualified — with their account, their profile, their CV and their history all
  exactly as they were. Their history now reads in the new words too.
- **Your To-Do still knows about them.** An agent's next call lives in Contacted
  now, and the To-Do follows it there.
- Assigning a lead to an agent works the moment you qualify him — he is in the
  "Responsible for this lead" list right away, and the lead shows up on his own
  board and his own To-Do.
- The board comes seeded with an agent card in each column — Qualified
  included, with a real agent account behind it — so the new section is not a
  blank slab the first time you open it.
- When a new number brings an agent back to Lead, his history says so in words —
  "Returned to Lead — new number added" — exactly as a partner's always has.
- If a search leaves one of the two sections with nothing in it, it now says
  "No cards match these filters." instead of claiming you have no cards there.

## A "Data entry" user who only adds (2026-08-17)
- New account type: **Data entry**. Tick it in Users like any other role.
- They can do exactly two things: **add a lead** and **add a partner or
  agent card** (CV included). That is the whole list — they cannot move a
  card, edit or delete anything, confirm a win, assign an owner, or open
  Won Leads, Statements, Users, Registrations, Agents or the Partners
  directory. Typing an address in by hand does not get them in either;
  the rules are enforced on the server, not by hiding buttons.
- **What they add has no owner.** It waits until you decide who takes
  it. They never appear in the "Assign owner" list themselves.
- So you can find that queue, the Leads filters (and the CRM board's
  owner filter) gained an **"Unassigned"** choice, and **you get a
  notification** each time — "New lead added by X — needs an owner" —
  that opens the lead when you click it.
- Their own page shows what they have entered and whether it is still
  **Waiting for an owner** or has been **Picked up**. They can correct a
  typo until someone picks it up; after that it is read-only to them.
- Every lead and card now quietly records **who typed it in** — separate
  from who owns it — whoever entered it.
- Small fix everywhere: if you open a page your account does not have,
  you now land on your own home page instead of the sign-in screen.

## Partners & Agents — follow up on both from one board (2026-08-17)
- The **Partnership CRM** is now **"Partners & Agents"**. Same board,
  same columns, same everything you already use — it just holds two
  kinds of card now, so partners and agents sit side by side and you
  follow them up together.
- The **Add** button asks first: **partner or agent?** Choosing changes
  the fields underneath. A partner asks for what it always asked for. An
  **agent asks exactly what the public application form asks** — first
  name, last name, phone, email, address, speciality and their **CV** —
  so a person you add by hand ends up identical to one who applied.
- But on an agent card **only the name and the number are required.**
  Everything else — email, address, speciality, the CV — is optional, so
  you can open a card in the middle of a phone call with nothing else in
  hand and fill the rest in whenever it arrives. (Partner cards are
  unchanged: company name and business activity are still required.)
- Every card wears a small **Partner** or **Agent** chip so you can tell
  them apart at a glance.
- Dragging, follow-ups, meetings, the "didn't answer" number picker,
  recordings, lost reasons — all of it works the same on both kinds.
- **Won is where they differ, and where the questions get asked.** A
  partner still becomes a partner in the directory. An **agent becomes
  an account**: the Won step fills in whatever the card already knows
  and asks for the rest — address, speciality, and **the email and
  password you choose for them**. They can sign in immediately, with no
  registration to approve, and any CV on the card moves onto their
  profile. They appear in **Agents**, not in the Partners directory.
  If a field is missing, the Won step says exactly which one.
- **People who apply on their own still just wait in Registrations.**
  They never appear on the board. Only the ones you put there do.
- The card's page shows the agent's address, speciality and CV, and
  after they are Won it tells you which email they sign in with.

## Permanently delete a user (2026-08-17)
- Users now has a **"Delete"** button beside "Remove". Remove is the old,
  reversible switch-off; **Delete wipes the account for good**. It asks
  twice and the second question names the person, so the two can never
  be confused.
- **What is kept:** their leads — they go back to the admin bucket so you
  can hand them to someone else with "Assign owner"; their comments;
  the whole activity log; and every statement, so the money trail still
  shows who closed what.
- **What is destroyed:** the login and its roles, the agent profile and
  its CV file, and their notifications. If the person is a partner's
  login, the **partner company stays** — only the sign-in goes.
- You cannot delete yourself, and you cannot delete the main admin
  account (it is recreated automatically). Deleting cannot be undone,
  and the deletion itself is recorded.

## Call the lead from your phone — and see everything while you talk (2026-08-17)
- Every board card and every lead now has a **"Call"** button. It opens
  a new **call sheet**: one page, built for a phone, with the lead's
  name and company at the top and a big **"Call now"** button that hands
  the number straight to your phone's dialer. Tapping "Call" on a card
  never drags it and never opens the wrong page.
- The number is cleaned up for dialling (spaces, dashes and brackets
  removed, 00 turned into +) while still being shown exactly as it was
  typed.
- Underneath the button, in the order you need it while talking: the
  email (tap to write), the details (owner, type, industry, position,
  company, requirements, notes, date created), the **latest update**,
  the **chat** — where you can type a note mid-call — the negotiation
  notes, every **stage record** (follow-ups, meetings, proposals, lost
  and won details) and the full **history**.
- The name and the Call button stay pinned to the top as you scroll, so
  the number is always one thumb away. The page works at every width,
  in Arabic, and it obeys the same access rules as the lead itself.
- Because the phone's dialer takes over, coming back from the call
  leaves the page exactly where you left it.

## Assign a lead to an agent or a partner (2026-08-17)
- Open any lead and press **"Assign owner"** (admin only). Pick one of
  your agents, partners or internal sales colleagues and the lead
  becomes theirs: it appears on their CRM board, on their To-Do page,
  and it counts as their lead everywhere — they are the owner.
- They get a notification in their bell ("Assigned to you: …") that
  opens the lead in one click.
- The **referring partner does not change**. If a partner introduced
  the lead, that credit stays on the lead permanently — assigning it to
  someone to work on is a separate thing, and the lead now shows both:
  who owns it and who brought it.
- Assigning is undoable for a few minutes like any other action, and it
  is recorded in the lead's history with who did it and when. Archived
  leads must be unarchived first.

## Follow up again, set a response date, reschedule a meeting (2026-08-17)
- Inside a lead that is in **Following Up** there is now a **"Log
  another follow-up"** button. You followed up, they need another call
  next week — press it, pick the date (and time, and how you will reach
  them) and save. The lead stays exactly where it is on the board; the
  new date replaces the old one on the card and on your To-Do page, and
  both follow-ups stay in the lead's Stage records.
- Inside a lead in **Negotiation** there is **"Set the response date"** —
  the day you promised the client an answer on the proposal. It shows on
  the card as "Response: …" and lands on your To-Do page like any other
  dated task, so the date cannot be missed.
- Inside a lead in **Meeting Setting** there is **"Reschedule the
  meeting"**. It records the new date, time and mode; the board and the
  To-Do switch to the new appointment and the old one stops showing as
  overdue — the original still stays in the lead's history.
- The same two buttons (another follow-up, reschedule) are on the
  Partnership CRM cards as well, and everything works for every role,
  in Arabic, and with Undo — which now says "Recorded another follow-up
  on …" rather than pretending something moved.

## Undo your last action (2026-08-14)
- Did something by mistake? A small "Undo" button now appears at the
  bottom of the screen right after an action, and it tells you exactly
  what it will take back — for example "Undo · Moved Acme Corp to
  Following Up". One click, no questions asked, and the screen updates.
- It covers moving a lead to another stage (the follow-up, meeting,
  proposal, negotiation note or lost reason that move created is removed
  with it), the "Didn't answer" flag, "Mark ready to close", archiving
  and unarchiving, editing a lead's details, adding a lead, and moving a
  partnership card. It works the same in both apps and in Arabic.
- On purpose, some things are NOT undoable: deleting (the data is gone),
  and anything to do with money — confirming a win, converting a
  partner, ticking a milestone, creating or paying a statement. After
  one of those the Undo button simply doesn't appear, so it can never
  quietly take back something older instead.
- Other rules that keep it safe: only you can undo your own action, only
  the last one, only within about ten minutes, and never if someone else
  has touched that lead in the meantime — in which case it says so
  instead of overwriting their work.

## Search and filters on the CRM boards (2026-08-14)
- The CRM board now has the same search and filters as the Leads page:
  a "Filters" button above the board opens the same card, with the
  search box (name, company or number), Type, and — for the admin —
  Owner. Only the matching cards stay on the board; "Clear filters"
  puts everything back, and if nothing matches the page says so
  instead of showing a row of empty columns.
- It opens by itself whenever a filter is on, so you always see what is
  currently applied — on the Leads page too.
- The ByteForce board got the same search and Type filter.
- Note: the admin's Internal / Agents / Partners / Admins tabs on the
  board are now the "Owner" dropdown inside that card, so all the
  filtering lives in one place. Say the word if you want the one-click
  tabs back as well.

## New lead type: Organic (2026-08-14)
- Lead type now offers "Organic" alongside Cold call, Event data,
  Personal connection and Campaign lead — for the leads that simply
  show up on their own. It is available everywhere a type is chosen or
  shown (both apps' add and edit forms, the partner's add-lead form,
  the Leads filter sidebar, lead pages and board cards), in English and
  in Arabic. Existing leads are untouched.

## Leads filters v2 — a real sidebar and one search box (2026-08-14)
- The B-Systems Leads filters moved out of the crowded row above the
  table into a proper sidebar next to it: Search, Owner, Stage, Type,
  Sort and View, each under its own small heading, with Apply and a
  "Clear filters" link that appears as soon as anything is set. On a
  phone or a narrow window the sidebar folds into a single "Filters"
  button above the table — it shows a small number telling you how many
  filters are currently on, and the table keeps the full width.
- New search box at the top of the sidebar: type anything and it
  matches the lead's name, the company name, or the phone number — one
  box, either way. Spaces and dashes in a number don't matter, so
  "010 123" finds 0101234567, and a part of a word is enough. If
  nothing matches, the page says so plainly instead of looking empty
  for no reason. Your links keep working: any Leads address you had
  bookmarked still opens the same list.
- Arabic now works everywhere it should: the whole sidebar is
  translated, and Arabic lead names and companies can finally be saved
  and searched — the local database was previously built in a
  Western-European encoding that rejected Arabic letters outright. If
  you are running the app on your own machine with an older local
  database, it needs to be recreated once (your data can be carried
  over) — ask and it will be done.

## Hardening (2026-08-14)
- Archived leads are now truly frozen: no stage moves, flags, or edits
  until you unarchive (the lead page says so plainly; the team chat
  stays open). Archiving also removes the lead's statement and
  milestone reminders from the To-Do page — the money records
  themselves stay on their pages.
- The To-Do page no longer resurfaces outdated items: an old follow-up
  that was followed by a sent proposal, or an old confirmed meeting
  superseded by a newer pending one, stays gone.
- Days on the To-Do page now change over correctly on Egypt's
  daylight-saving switch nights — nothing due in the last hour of the
  eve is skipped.
- The ByteForce "Unassigned" card stays visible when all its leads are
  archived, so the archive remains reachable; and dragging a card back
  to New now reports any error on screen instead of silently snapping
  back.

## Archive leads (2026-08-14)
- Open any lead and click Archive (with a confirm step): the lead
  leaves the board, the lists, the dashboard numbers, and the To-Do
  page — nothing is deleted. The Leads page's new view dropdown has an
  "Archived" choice that shows everything in the archive; open a lead
  there and click Unarchive to bring it back exactly where it was.
  Works in both ByteForce and B-Systems (ByteForce rep tables got an
  Active/Archived toggle). Money records (clients, won deals,
  statements, payments) are never hidden by archiving.

## ByteForce board — full parity with the B-Systems board (2026-08-14)
- The ByteForce CRM board is now draggable: drop a card on a stage and
  that stage's form opens right there — exactly like the B-Systems
  board. Clicking anywhere on a card opens the lead, dragged cards stay
  on top of neighboring columns, and every card carries the "Didn't
  answer" button with its red "No answer" chip (also shown on the
  lead's page).

## Leads list filters and ordering (2026-08-14)
- The B-Systems Leads page can now be narrowed by Stage, Type, and
  Owner, and ordered three ways: newest added, recently updated, or
  pipeline priority — leads closest to closing float to the top and
  won/lost sink to the bottom. Plain dropdowns with an Apply button;
  the link to each lead is unchanged.

## To-Do page (2026-08-14)
- New "To-Do" section in both apps: one plain page with today's date
  showing everything in the system that is due today — follow-ups,
  arranged meetings, and (for the admin) partnership-prospect
  follow-ups and meetings, statements expected today, and payment
  milestones due — each row linking straight to the lead or record.
  Anything already past its date sits in a red "Overdue" section on
  top, so nothing slips. Everyone sees exactly their own scope: the
  admin sees everything, internal sales their bucket, agents and
  partners their own leads.

## ByteForce board shows every lead (2026-08-14)
- Adding a lead in ByteForce now shows it on the CRM board immediately:
  the board gained a "New" first column listing every lead that hasn't
  been actioned yet (with the date it arrived), exactly like the
  B-Systems board. Unassigned leads keep their "Unassigned" label.

## Didn't-answer marker (2026-08-14)
- Every active card on the main CRM board now carries a small "Didn't
  answer" button — clicking it puts a red "No answer" chip on the card
  (and on the lead's page header) so the whole team knows at a glance;
  once the client answers, "Answered — clear flag" removes the chip.
  It's a marker only: the lead stays exactly where it is on the board,
  and both moves are recorded in the lead's history.
- The chip now also clears itself the moment the lead moves to any
  other stage — moving a card means the client was reached, so the "No
  answer" marker disappears on its own (still recorded in the lead's
  history).

## Board card fixes (2026-08-13)
- Board cards no longer clip long text: a long lead or company name now
  wraps inside the card and trims neatly at two lines instead of
  spilling past the card's edge (CRM board and partners pipeline board
  alike).
- Clicking anywhere on a board card now opens that lead's detail page —
  no need to aim for the small name link. Dragging works exactly as
  before, and finishing a drag never opens the page by accident.
- While dragging, the card now stays visible on top of the neighboring
  columns instead of disappearing behind them.
- Owner list now populated in the board's stage forms: dropping a card
  on a stage whose form has an Owner field (and the same forms on the
  lead page and the partnership pipeline) now lists the B-Systems sales
  team — every active sales account appears automatically, no separate
  rep setup needed. Previously the list could show only "—" on a live
  system.

## Arabic ⇄ English (2026-08-13)
- The whole platform now speaks Arabic and English: an EN | عربي toggle
  in both app headers (desktop and mobile) and on the login page
  switches every single piece of content in the app — dashboards, CRM
  boards, lead details, the team chat, won leads, statements (including
  the printable statement document, which is bilingual), payments,
  users, registrations, agents, profile, notifications, the partners
  pipeline and directory, sign-up, and browser-tab titles.
- Arabic renders fully right-to-left across every screen.
- Your language choice is remembered per browser and holds across pages
  and visits; English remains the default.
- Known limits this round: error messages coming back from the server
  (form validation and service errors) still appear in English, and a
  few ByteForce browser-tab titles remain partly English.

## SSL audit (2026-08-12)
- Security fix: clicking Log out could redirect to an insecure http://
  login page when the hosting proxy misreports the connection scheme —
  logout now always uses a same-origin relative redirect. The audit
  confirmed nothing else code-side can cause the browser's "Not secure"
  badge (no mixed content is possible); the badge itself is a
  Cloudflare/host TLS configuration matter.
- Every lead now has a built-in team chat on its detail page — in both
  the B-Systems CRM and the ByteForce CRM — so questions and answers
  live with the lead and you have the full picture before you talk to
  them.
- Type @ in the composer to mention a teammate: an autocomplete suggests
  exactly the people who can see that lead, and mentioned people get a
  bell notification. ByteForce now has its own notifications bell in the
  header, so mentions reach ByteForce staff too.
- Messages an admin posts while acting as someone else are labeled
  "Name (via AdminName)" — in the thread, in the mention notification,
  and in the activity log — so impersonated messages are always
  transparent.

## Logo fixes (2026-08-12)
- The printable statement document now shows the real B-Systems logo
  mark instead of the placeholder "S" gradient square.
- Header logos now link to the current app's home instead of the
  platform root: the B-Systems logo+wordmark goes to your first nav
  page (/b-systems for admins, /b-systems/crm for everyone else); the
  ByteForce logo goes to /byteforce. Both links have aria-labels.

## Uploads durability incident fix (2026-08-11)
- Fixed the production incident "uploaded files lost on redeploy": links
  to payment proofs, CVs, recordings, and proposal/contract PDFs no
  longer dead-end after a redeploy wipes the container disk.
- Missing files are now clearly flagged everywhere: the admin Statements
  page shows "proof file missing" with a Re-upload proof control (and a
  Replace proof control when the file is fine — paid statements only);
  the closer Payments page says "proof file missing — ask the admin to
  re-upload it" instead of a dead link; the printable statement omits
  its "Payment proof on file" line when the file is gone; prospect
  detail shows "Recording file missing" instead of a broken player.
- Opening a missing file in the browser now shows a styled explanation
  page (what happened, how to fix) instead of a raw error message.
- /api/health now reports uploads diagnostics: storage path, whether a
  persistent directory is configured, a writable check, and how many
  attachment files are missing from storage.
- Durable storage requires a one-time host setup: attach a persistent
  volume and set UPLOADS_DIR to its mount path (ADR-035) — until then,
  every redeploy wipes uploads again.

## Founder V4 round — Partnership CRM (2026-08-11)
- Partnership CRM board is now draggable like the main CRM: dropping a card
  opens the target stage's form in a modal (numbers, follow-up, meeting,
  Won completeness gate, lost reason); cancel reverts; dropping back onto
  Lead commits directly; Won and Lost cards can no longer be moved (toast).
- Admins can edit and delete pipeline cards and directory partners:
  deleting a card removes its stage records and recordings (incl. stored
  files) and, for converted cards, the directory Partner — attributed
  leads remain with attribution cleared; deleting a partner keeps the
  login account (removable in Users).
- Wide-screen layout fix: full-bleed board columns now start at the
  centered content edge instead of crowding the right; prospect and
  partner detail pages use the standard page-head layout.

## Founder V3 round (2026-08-10)
- Founder V3: two-way impersonation, agent-registration approval cycle,
  won-deal math barriers, printable statements, animated dashboard,
  full-bleed boards.

## PostgreSQL switch (2026-08-09)
- PostgreSQL everywhere (ADR-033): fresh init migration, embedded local
  Postgres for dev/tests, dev data carried over via the backup system.

## V2 — Unified role-aware B-Systems CRM (2026-08-09)
- Portal merged into the role-aware B-Systems CRM: negotiation stage,
  milestone-tab confirm-win, won leads/statements/payments, users +
  impersonation, agents/registrations sections, colored draggable board.
- Design system applied from the approved Claude Design prototype (ADR-031):
  new token sheet, dark B-Systems chrome, entity switcher, redesigned
  login/hub.
- Full admin backup/restore (ADR-032), animated UI motion layer, root now
  opens sign-in directly.

## Phase 5 — Hardening & handover (2026-08-09)
- Final demo seed: both brands populated across every stage, a converted partner
  with an attributed lead, and a won portal deal with a 3-milestone plan.
- Security proofs at the API level (rep/admin/staff walls); responsive + clean-
  console sweep at 1440/1024/768/390 across every screen; nav wraps on small
  viewports; B-Systems favicon (the S-mark).
- README with cold-start setup, demo accounts, test and deploy instructions.

## Phase 4 — Portal admin layer (2026-08-09)
- Admin dashboard (total leads, total estimated value, won deals, commissions).
- CRM with "All reps combined" / per-rep views; admin can move deals to Won.
- Won Deals management: estimated value + commission, milestone plans (any count),
  check/uncheck with sequential order; milestone sum warning (never blocking).
- Sales Team table: per-rep totals, per-stage counts, won value, commission.
- Reps see milestone unlocks live (≤5 s) without reloading.

## Phase 3 — Partnership Portal, rep layer (2026-08-09)
- Landing page with the B-Systems signature gradient; sign-up with CV (instantly
  active, lands in the portal); phone login.
- Rep CRM: six-column Trello-style board — drag between stages opens the stage's
  form, cancel reverts; Won is admin-only (blocked with a clear message).
- Won Deals view: auto-recorded wins, milestone values disclosed one at a time.
- Profile: view/edit basics, replace CV, change password.

## Phase 2 — B-Systems CRM + Partners (2026-08-09)
- Full B-Systems CRM (leads, pipeline, clients, dashboard) in the B-Systems brand.
- Partners Pipeline: six stages, cold-call recordings (mp3/mp4, playable inline),
  Didn't-Answer number slots with automatic return to Lead, Won completeness gate.
- Partners directory with date joined and each partner's live-stage leads table.
- Partner-sourced leads flow into the CRM with a permanent "Partner: {Company}" badge.

## Phase 1 — ByteForce CRM (2026-08-09)
- Leads: rep cards, per-rep tables, full lead detail with conditional stage forms.
- CRM board (five columns) driven by Next Actions and automatic transfers
  (proposal sent, meeting outcomes); History panel on every card.
- Clients: auto-created on Won with collection tracking; Home dashboard with all
  §6.5 numbers.

## Phase 0 — Foundation (2026-08-08/09)
- Both brand themes wired (ByteForce / B-Systems) with per-app login; shared
  pipeline engine; auth with roles; seed accounts.

## [0.0.0] — 2026-08-08
- Project starter: master specification, process tooling, brand token files for both
  companies. No application features yet.

## Accounting module — Phase 1: engine + import service (2026-08-17)
- New `Acct*` schema (11 models, company-tagged, Int piasters) with backup +
  reset registration; pure accounting engine re-implementing the legacy app's
  rules (cash-basis income, approval-gated expenses, derived auto-payroll with
  effective-dated salaries, media pass-through, loans with 50-piaster
  settlement epsilon, treasury carry-forward, client A/R, P&L, departments,
  targets); admin-only import endpoint accepting the old app's own JSON export
  (single company or "Export ALL"), replacing per company in one transaction
  and reporting exact reconciliation numbers. No UI yet — screens land in
  Phase 2.

## Accounting module — Phase 2: the eleven screens + import UI (2026-08-18)
- Full accounting section under B-Systems admin: dashboard, income, expenses
  (approval workflow + auto-payroll from the roster), clients A/R ledger,
  payroll roster (effective-dated), media buying (ByteForce only — hidden for
  B-Systems), loans, treasury, monthly P&L, departments, targets, and the
  one-time Import screen for the old app's JSON export with reconciliation
  totals. Bilingual EN/AR throughout; company switcher + month picker; admin
  only, with a server-side 403 wall on every route.

## Data Vault module — Phase 4: schema, services, invariants (2026-08-18)
- New `Vault*` schema (employees-as-cards, forms, sheets, documents, tasks;
  files as appended Attachment rows) with backup + reset registration; native
  services re-implementing the reference app's rules: the sheet link-XOR-file
  invariant, the task result gate (422 without a recorded result), lateness
  computed once at completion and frozen forever, audited reopening,
  archive-not-delete with undo on archive/restore, the duplicate-URL 409
  handshake, CSV auto-counting, and vault-wide grouped search. Platform-wide
  upload-sniffing upgrade: OOXML container discrimination (a bare ZIP renamed
  .docx/.xlsx is now refused everywhere), full CFB signature, CSV/TXT text
  sniff. No UI yet — the six screens land in Phase 5.

## Data Vault module — Phase 5: the six screens (2026-08-18)
- Full vault section under B-Systems admin: overview (counts, vault-wide
  search, recent activity), forms (duplicate-URL "save anyway" handshake),
  sheets (link or uploaded file, CSV auto-count, versioned file replacement),
  documents (typed files, versioned replacement), tasks (assignee cards, the
  result panel gating completion, live overdue badges, frozen lateness
  verdicts, reopen), employees (cards, deactivate-not-delete), and the
  per-kind Archive with one-click restore. Bilingual EN/AR throughout
  (authored Arabic — the reference app was English-only); one new admin-only
  nav item; server-side 403 wall on every route; archive/restore wired into
  the header Undo.

## Modules at the switcher + per-company brand + module import/export (2026-08-18)

- Accounting and Data Vault are now MODULES on the company switcher
  (BYTEFORCE | B-SYSTEMS | ACCOUNTING | VAULT — the module segments are
  admin-only), living at `/accounting/*` and `/vault/*` with their own
  app shells and section navs. They left the B-Systems nav.
- The modules wear the active company's WHOLE brand: accounting follows
  its company switcher (ByteForce default — orange & Lama Sans; B-Systems
  — indigo), the vault follows its company filter and wears the neutral
  look on "All".
- The accounting DASHBOARD keeps the original app's design (founder
  request): the gradient treasury hero and the color-coded KPI cards,
  re-branding with the company.
- Each module has its own Import and Export. Accounting's export writes
  the ORIGINAL app's exact JSON files (`{company}-accounting-DATE.json`
  and `all-companies-DATE.json`) — they re-import into the old system or
  this one, either direction, with identical derived totals (proven in
  tests, including against the founder's real export). The vault exports
  and re-imports everything it holds — records and files — as one
  admin-only file with a confirm step on the destructive import.

## WhatsApp beside every Call (2026-08-19)

- Every place a lead can be called now also offers "message on WhatsApp",
  right next to the Call control: the cards on both CRM boards, both lead
  detail headers, and the phone-first call sheet (a second big button under
  Call now). Opens in a new tab; on cards it neither drags nor opens the
  lead — exactly like the Call chip.
- wa.me needs the country code, so the link builds it: locally-typed
  Egyptian mobiles (01x…) get +20 prefixed automatically, explicit +/00
  numbers pass through as typed, and a number with no confident country
  form (a landline, a foreign trunk format) simply shows no WhatsApp
  button rather than a wrong link. The displayed number is never rewritten.

## Partners & Agents: Kind filter + Call/WhatsApp (2026-08-19)

- The Partners & Agents board now has the CRM boards' filter card: Kind
  (All | Partners | Agents) plus the same one-box search (name / company /
  number — spaced digits find packed numbers). Filtering is server-side
  and lives in the URL, so a filtered view can be bookmarked.
- Call + WhatsApp reach every partner/agent number: chips on each prospect
  card, the pair on the prospect detail header, chips beside EACH
  alternative number, on the directory partner's number, and beside each
  agent's phone in the Agents section.

## The header nav is a slider + the vault wears the B-Systems mark (2026-08-19)

- When the header sections do not fit (the clipped "Registrations"), arrows
  now appear at the ends of the strip and slide it; the cut edge fades so
  it is obvious there is more. Works unchanged in Arabic, on every app
  shell and module, and the section you are ON is always scrolled into
  view.
- The Data Vault's header logo is now the real B-Systems mark, whatever
  the company filter shows.

## Board columns stop growing (2026-08-19)

- A long column no longer stretches the whole CRM page: past roughly five
  cards it caps and scrolls inside itself, with a visible thin scrollbar
  tinted to the stage color. All three boards (ByteForce, B-Systems,
  Partners & Agents).
- Dragging works from and into scrolled columns: the dragged card's visual
  now rides an overlay above the board, so a clipping column can never
  swallow it mid-drag; the card left behind ghosts until the drop lands.

## To-Do: hand a task over, or take it yourself (2026-08-19)

- On /b-systems/todo, every row that comes from a lead now says who owns
  it, and (as admin) carries two controls: "Assign owner" — the same
  chooser the lead page has — and "Take it", one click to put the lead in
  your own hands. Assigning a to-do simply moves the LEAD, so the person
  you hand it to sees the task on their own To-Do, the lead lands on their
  board, and it counts as theirs everywhere. One press of Undo puts it
  back.
- "Take it" only appears when the task is not already yours, and taking
  something does not ring your own bell — the other person still gets
  notified when you hand them work.
- Rows that are not a lead — a partner/agent follow-up, an expected
  statement, a due milestone — stay plain lines: those are yours already,
  so there is nobody to hand them to. Agents and internal sales see their
  To-Do exactly as before, with no controls at all.
- The ByteForce To-Do is unchanged for now: ByteForce leads carry a sales
  rep NAME, not an account, so there is no colleague's system to move the
  work into. Tell us how you want it to behave there.

## Cards get a grip, so your thumb can scroll again (2026-08-19)

- On the phone: **touching a card now scrolls, it does not drag.** The column
  scrolls inside itself, the board slides sideways, and the page keeps
  scrolling past the bottom of a column — so the leads underneath are
  reachable again.
- To MOVE a card, use the little **grip on its edge** — six dots, a thumb-sized
  button halfway down. Drag from there and the card goes to the next stage
  exactly as before. Tapping the grip does nothing; tapping the card still
  opens the lead. Everything around the grip — above it, below it — scrolls
  like the rest of the card, so there is no strip of card you cannot scroll.
- On a computer **nothing changed**: the mouse still drags the whole card.
- Why it was broken, in one line: the card itself was the drag handle, and a
  drag handle has to tell the browser "no scrolling starts here". Cards cover
  the whole board, so that one rule switched off all three scrolls at once.
- All three boards (ByteForce, B-Systems, Partners & Agents). In Arabic the
  grip sits on the card's left, where it belongs.

## The layout survives browser zoom (2026-08-19)

- **Zoom out and nothing slides off the side any more.** At 90%, 80%, 67%, 50%
  and 25% the CRM page used to grow a horizontal scrollbar and push the board's
  left edge off the screen — up to 22px gone at 25%. That is fixed at every
  zoom step, on all three boards.
- **The board no longer jumps sideways on its own.** It used to shift by up to
  15px the moment a page grew long enough to scroll — filter the board, add a
  card, and everything under the title moved. It now stays exactly where the
  title says it should be, at every zoom.
- The board keeps what you asked for: it still **fills the whole page** rather
  than the centered column, and its first column still **starts level with the
  page title**. Both are now pixel-exact from 25% to 300% zoom instead of only
  at 100%.
- **The "about five cards" column cap is real again.** It was written against
  the window height, so what you actually got was two and a half cards at
  normal zoom and less than ONE card at 300%. A column is now never SHORTER
  than two whole cards however far you zoom in, and never more than about five
  however far you zoom out — and it still caps and scrolls inside itself, so
  the endless column cannot come back. (Two honest notes: past about 200% zoom
  the screen itself is shorter than two cards, so you scroll the page to reach
  the second one — still far better than the sliver of a card you got before.
  And on a screen taller than about 1500 points, a full column is now taller
  than it used to be: that is the "about five cards" you asked for arriving,
  where the old cap stopped at under three. Tell us if you want five cards at
  normal zoom too — that is one number, see below.)
- Two smaller things found on the way and fixed: at very narrow widths (and at
  300% zoom) the **company switcher** in the header was pushing the whole page
  sideways — it now moves into the menu at the same width where Log out
  already does; and the header's **section arrows** could go missing when a
  section name was clipped by less than a pixel at an in-between zoom, which
  was the "Registrations → Regi" problem coming back quietly.
- One thing we did NOT change on purpose: zooming in far enough still turns the
  desktop menu into the burger menu. That is the same behaviour as making the
  window narrow, and it is what keeps every section reachable at any size.

## Salaries lock to the roster, campaigns get their own cost line, B-Systems gets a department (2026-08-22)

- **A salary can no longer be edited from the Expenses screen.** The "Edit in
  roster" shortcut on a salary row is gone. To change what someone earns, open
  Payroll Roster — that is the only door, and it changes the salary from that
  month forward. The row itself still does everything legitimate: approve /
  hold, "Adjust this month only" for a one-month deduction or bonus, and the
  "from roster" badge now explains where the salary actually lives — hover it
  on a computer; on a phone the "Adjust this month only" window opens with
  the same pointer written out, so the explanation is never hidden behind a
  hover you cannot do on touch.
- **New expense type: "Media Buying / Campaigns."** This is for OUR OWN
  campaign spend — it is a real cost and it counts against profit, unlike
  "Media Spend (pass-through)" which is client budget flowing through the
  treasury. Both companies have it, in English and Arabic. The two sit next
  to each other in the Type list so you always know which one you are picking.
- **"B-Systems" is now a department.** Pick it on an expense (the select whose
  blank choice is "— Overhead —"), on an income row, or on a person in the
  roster. Anything tagged to it moves out of "Shared / overhead costs" and
  onto its own line in the Departments report — note that is a move BETWEEN
  report lines; the net profit number itself does not change.
- **Switching apps works on the phone now.** On any small screen there is a
  bar right under the header with BYTEFORCE · B-SYSTEMS · ACCOUNTING · VAULT:
  one tap, big targets, and the app you are in is clearly marked. No more
  hunting through the burger menu, and no more page being pushed sideways at
  in-between widths (that was real: 44px of sideways overflow around 601px).
  The burger menu still has everything too, now finger-sized and readable —
  finger-sized in both directions, including the little EN / عربي toggle. And
  on an unusually narrow screen the long names shorten with "…" instead of
  being cut off invisibly.
  On a computer nothing changed, and people with only one company see no bar.
- **The saved app wears the real logo.** Add the system to your phone's home
  screen and you get the official B-Systems mark — on iPhone and Android,
  named "B-Systems" — instead of the old coloured square. The login tab's
  favicon is the real mark too. Each app inside keeps its own icon.
- One heads-up for old-app exports: a file carrying the new expense type or
  the new department still adds up to the same totals in the ORIGINAL app,
  but the old app shows the raw id instead of a label and its Departments
  report cannot place a B-Systems-tagged row. Files exported from the old
  app import here exactly as before.

## Follow-ups are just a date, a Today filter on the board, and a shorter To-Do (2026-08-23)
- **No more picking a time for a follow-up.** You said "remove the time of
  the follow up just the date" — done, everywhere. Every follow-up form asks
  for the day only, and everywhere a follow-up shows — the board cards, the
  lead's records, the call sheet, the To-Do — it is just the date, no clock.
  Meetings still have their time; a meeting is a real appointment.
  Everything already recorded is untouched — it simply shows without the
  time now.
- **A "Today" filter on the Following Up column.** On both CRM boards the
  Following Up column has a little chip at the top: "Today · 3" means three
  cards are due today. Press it and the column shows only today's
  follow-ups; press it again and everything comes back. The number is
  today's count either way, and you can still drag cards in and out while
  it is on. If nothing is due today, the filtered column says
  "No follow-ups due today" instead of pretending to be empty. In Arabic
  it reads "اليوم". (The partners board has no
  Following Up column, so there is nothing to put it on there.)
- **The To-Do shows today, full stop.** The Overdue section is gone, and
  the partner/agent pipeline rows are gone from the To-Do — that list is
  your day, not the partners funnel. One thing to know, exactly as you
  asked: a follow-up you missed yesterday will NOT appear on the To-Do any
  more — you will still see its date on the lead's card on the board.
  Money is the exception on purpose: a statement or milestone expected
  yesterday still sits under Today until it is settled, so a payment can
  never quietly disappear.

## The To-Do gets a checkbox, and finished tasks stop disappearing (2026-08-23)
- **Check a task off.** Every row on the To-Do — follow-ups, meetings, and
  for the admin the statements and milestones — now has a checkbox at the
  start. Tick it and the task drops out of the day's list into a "Done"
  section underneath, crossed out, with your name on it: "Done · Elmur".
  Ticked by mistake? Untick it in Done and it comes straight back.
- **The CRM completes tasks by itself, visibly.** Exactly as you described:
  if an agent has a Follow Up task and the lead moves on to Meeting Setting,
  the system understands the follow-up happened. Before, that task just
  silently vanished; now it moves to Done and says WHY — "Moved to Meeting
  Setting", "Superseded by a newer step", "Meeting attended", "Paid",
  "Milestone completed". Those rows can't be unticked from the To-Do —
  undoing them means undoing the CRM move itself, which stays where it
  belongs, on the board.
- **A new follow-up is a new task.** Recording another follow-up on the same
  lead never inherits an old tick — it always arrives unchecked. Same for a
  rescheduled meeting: new time, fresh unchecked task.
- **Money still never vanishes.** Ticking a pending statement or milestone
  clears it off TODAY's list only. If it is still unpaid tomorrow, it is
  back on the list unchecked — the only way to silence it for good is to
  actually mark it paid or complete the milestone. The Done section says
  "Completed today" on it, so nothing about that is a surprise the next
  morning.
- **A delayed meeting is not a finished one.** Push a meeting to another
  day and it simply leaves today's list and turns up again on its new date —
  it does not land in Done. Delay it to later the same day and it stays
  where it is, still waiting to be ticked.
- Everyone gets the checkbox on their own tasks — admin, internal sales,
  agents, partners, and the ByteForce side — and nobody can tick a task on
  a lead they cannot see (that is enforced on the server, like everything
  else). Works in Arabic, right-to-left, same as the rest.

## The time on a follow-up is back — and it is yours to give or skip (2026-08-25)
- **The time box is there again, and nothing makes you fill it.** You said
  *"let's get the time back for the follow up but it's not mandtory"* — so
  every follow-up form now shows **Follow-up date** and, beside it,
  **Follow-up time (optional)**. Fill it when the appointment is at a
  particular hour; leave it alone when the day is the whole point. Every
  role sees it: your side, the sales team's, agents', partners', and the
  partners board too. In Arabic it reads **وقت المتابعة (اختياري)**.
- **If you leave it blank, nothing on any screen changes.** The card still
  says "Next: 25 Aug 2026", the lead's records still say "Due 25 Aug 2026",
  the To-Do row still shows the day. No 9:00 AM appears out of nowhere —
  that was the whole reason to take the time away three days ago, and it
  stays true.
- **If you give a time, it comes back everywhere it matters.** The board
  card, the lead's records, the call sheet and the To-Do all show
  "25 Aug 2026, 16:45". Two follow-ups can sit side by side, one with a
  time and one without, and each reads exactly the way it was written.
- **Your OLD follow-ups get their times back too.** Every follow-up
  recorded before we removed the field had a time you actually typed, and
  those times are now showing again. The one exception, so you are not
  surprised: if you deliberately picked 9:00 in the morning back then, that
  one now shows as just a date — 9:00 is the hour the system itself uses
  when nobody chooses, so it is the one time we cannot tell apart from
  silence. Tell us if you would rather we handled that differently.
- **Restoring a backup never invents a time either.** If you ever export the
  system and load it back, every follow-up comes back reading exactly the way
  it read before — the ones you dated stay dates, the ones you timed keep
  their hour. Backups taken before this week still get the old times back on
  the way in, same rule as above, but a backup taken from today onward already
  knows the answer and is trusted to say it.
- **A time never changes which day a follow-up belongs to.** A follow-up at
  23:45 tonight is still on TODAY's To-Do and still counts under the
  "Today" chip on the board. The time is a detail of the day, never a
  reason to move it.
- Meetings are untouched — a meeting still asks for its time and always
  shows it. That never was the thing you wanted removed.

## Meeting Setting reads like a diary, and "didn't answer" counts (2026-08-25)

**You asked for two things.**

### 1. "The column of meeting setting should be in time order, always."

- **The Meeting Setting column is now sorted by when the meeting actually
  happens** — the soonest one at the top, then the next, then the next. Open the
  board and read straight down: that is your day. It is not a button you switch
  on; the column simply works that way now, on the ByteForce board, the
  B-Systems board, and the Partners & Agents board.
- **A card whose meeting has no time yet waits at the bottom.** It does not
  disappear and it does not sit in the middle pretending to be scheduled — it
  stays where you can see it, under the real appointments, still saying
  "Meeting not arranged" until someone sets the time.
- **Every other column is exactly as it was.** Nothing else was re-sorted.

### 2. "Also add the Today filter on top."

- **The same little "Today" button you got for Follow Ups is now on Meeting
  Setting too.** It tells you how many meetings you have today before you press
  it, and pressing it hides everything else so the column shows today only.
  Press it again to see everything.
- **"Today" means today in Cairo**, whatever clock the laptop or the phone is
  set to.
- **The Partners & Agents board gets one for the first time.** It never had a
  Follow Up column to put the first chip on — it does have a meeting column.
- If you press Today and nothing is on today, the column says **"No meetings
  today"** rather than pretending it is empty. Your cards are still there.
- You can still drag a card into the column while the filter is on — and the
  filter lets go the moment the card lands, so you SEE the move you just made.
  It used to swallow it: a card you drag into Meeting Setting has no meeting
  time until you tick "we agreed on a time", so with Today pressed it was
  filtered straight back out of the column you had just dropped it in. Press
  Today again whenever you want it back; the count never changed.

### 3. "Make the didn't answer button a counter so we can know how many times we tried."

- **Every press of "Didn't answer" now counts one more try.** Press it once and
  the card says **No answer**, exactly as before. Press it again and it says
  **No answer · 2**. Again, **No answer · 3**. Hover it and it says it in words:
  "Tried 3 times".
- **The first try shows no number on purpose.** A "· 1" is just clutter — the
  badge being there already means you tried once, and hovering says so.
- **"Didn't answer" now stays on the card.** It used to turn into "Answered"
  after one press, which meant a second try could never be recorded. Now both
  buttons sit there: keep pressing "Didn't answer" for each attempt, and press
  **"Answered — clear flag"** the moment they pick up.
- **Answered wipes the count back to nothing**, and the next run of attempts
  starts again at one.
- **Moving the card to another column still clears it**, as it always has —
  reaching them is the whole point, so the count starts fresh with the new
  stage.
- **Undo gives the exact number back.** Undo the fourth try and the card reads
  three, not zero. Undo an "Answered" press and your number comes back.
- **The number shows everywhere the marker shows** — the board card, the lead's
  page, and the call sheet, so mid-call you can see you have already tried three
  times.
- **Restoring an old backup keeps the marker.** A backup taken before today does
  not know about counting. Loading one back in no longer drops the "didn't
  answer" marker off those cards — each one comes back saying you tried once,
  which is all an older backup can honestly claim. A backup taken from today
  onward comes back with its exact numbers.
- All of it reads properly in Arabic, right to left: **لم يرد · 2**, and hovering
  says **عدد المحاولات: 2**.
