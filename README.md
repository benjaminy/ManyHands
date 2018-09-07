ManyHands
=========

Many hands is an application implementation of the **United We Stand (UWS)** protocol. This protocol outlines an encrypted and server-less model for shared document editing.

A server-less shared document editing protocol can be used for a variety of different applications like shared calendars, collaborative spreadsheets, or chore management applications (like many hands itself).

#### Motivation for the UWS protocol

Over the course of the past decade, the privacy and security of online communication have become a paramount concern. This increasing importance can is perhaps most clearly seen in the rapidly developing field of secure messaging applications like Signal, WhatsApp, and many others. These secure chatting applications have provided a secure mode for individuals to chat with lessened fear that a malicious third party is listening in to their messages.

The UWS protocol aims to utilize the same messaging protocols that are used in these messaging applications to create a secure and robust system for sending edits to a shared document.

Furthermore, by removing a central server from the protocols’ model, the system as a whole can be more resilient to 3rd party efforts to limit users access to the system using blocking.

#### ManyHands chore management for teams
ManyHands is an example application of the many possible systems that could be built which implement the UWS protocol.

### Many Hands in 100 words

As a ManyHands user, you belong to any number of teams.  Each team has
any number of tasks.  Each time you do a task, you simply click a button
and the system records that you did it and shares that with your team.
You can then look at the history of any given task to see who has been
doing it.  The plan is to keep it as simple as possible; no social media
tie-ins or dancing bears.  The hope is that this simple tool will help
people share the work of routine chores with less fuss and stress.

## A bit more detail

The motivation for the project is that there are lots of mundane tasks
that teams of people have to do, and working out who's going to do what
when is often more stressful and time-consuming than it should be.
Maybe technology can help a little.  The big-picture ideas:

* Fair division of work
* Reminders
* Mild social pressure

### Fair division

One of the assumptions that ManyHands is based on is that the members of
your team basically want to do their fair share of the work most of the
time, but it's sometimes useful to have a little nudge.  In ManyHands
team members create shared tasks (washing the dishes, walking the dog,
buying the snacks, ...) and then just poke a button when they do a task.
It will be easy to scan back over the history of a task to see whether
everyone has been doing their fair share.

Maybe we'll explore algorithmic fanciness to compute exact percentages
of work and whatnot, but it might be better to keep it super simple.

### Reminders

Even if everyone is totally committed to doing their fair share of the
work, it's easy to forget (oh no, we missed garbage night again), which
can lead to the least absent minded person doing more work than everyone
else.  If a team gets into the habit of using ManyHands regularly, then
people don't have to try to remember to do chores.  They have a nice
prioritized list right there.

### Social pressure

ManyHands might even be useful for tasks that aren't really shared, like
going to the gym or practicing an instrument.  Knowing that friends and
family will see whether you clicked the button or not might provide just
the right size of nudge to get people to do things they might otherwise
let slide.
