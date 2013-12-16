ManyHands
=========

#### Chore management for teams

> ManyHands doesn't exist yet in any substantial sense (as of late
> 2013), but I'm writing down the idea in hope of getting to work on it
> some day.

ManyHands will be a simple web app that helps small teams (families,
sports teams, social clubs, bands, ...) managed shared chores.  It's a
sort of shared to-do, reminder kind of thing.

### Many Hands in 100 words

As a ManyHands user, you will belong to any number of teams.  Each team
has any number of tasks.  Each time you do a task, you simply click a
button and the system records that you did it and shares that with your
team.  You can then look at the history of any given task to see who has
been doing it.  The plan is to keep it as simple as possible; no social
media tie-ins or dancing bears.  The hope is that this simple tool will
help people share the work of routine chores with less fuss and stress.

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

### Emphatic non-goal: chore-doing enforcement

We assume that everyone on the team is basically committed to the
harmonious functioning of the group.  We have no interest in creating a
system that somehow tries to verify that someone did what they claim to
have done.

## Technical Ideas

Here are the ideas we've had for implementing ManyHands so far.

There are two non-trivial technical issues with implementing ManyHands:

* Shared "document" management
* Storage/authentication/etc

### Shared "document" management

Ideally ManyHands will work on all kinds of devices so that people can
check off a task will miniaml effort.  (Mobile phones seem like a
particularly attractive platform.)  It should definitely work offline
seemlessly, which creates a concurrent versioning problem.

The iniitial idea is to use version control software, like git, to take
care of all the low-level versioning stuff.  There can still be issues
with people concurently making inconsistent changes (like adding and
deleting tasks), but those issues should be manageable.

There is a Javascript git implementation that might prove useful:

https://github.com/creationix/js-git

### Storage/authentication/etc

Where should a team's tasks be stored?  We are not particularly
interested in doing the hosting ourselves.  Ideally there would be a
bunch of good options.  Maybe Dropbox?  How should authentication be
done?
