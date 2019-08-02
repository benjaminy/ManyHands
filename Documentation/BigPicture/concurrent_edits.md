In any concurrent editing framework, the challenge of potentially conflicting edits is clearly of central importance.
There are three families of strategies for handling this challenge:

- Merging concurrent edits
- Waiting for some kind of commit/consensus
- Rolling back edits

I think the most important big-picture point is that it is easy to imagine application scenarios where each of these strategies is clearly desirable.

- If edits do not semantically conflict with each other, then it's obviously good for a framework to transparently merge them.
- Some edits cannot be tranparently merged, but are low stakes, so that waiting for consensus would be very annoying.
For example, maybe a team is maintaining a website and two users concurrently change the background color.
- Some edits cannot easily be rolled back (the proverbial launching of missiles), so it's important to wait for consensus.

(Quick aside: it is common for CE applications to completely discard some information during edit conflict resolution.
This seems just plain bad.
A good CE framework should save all edits by default, though surfacing this in the UI is a non-trivial challenge.)

One broad family of technologies that is quite popular for collaborative editing is operational transformation (OT) and conflict-free replicated data types (CRDTs).
These technologies put the focus on merging.
That is, the goal that is often emphasized is to find a way to consider edits mergeable, even if they appear to be conflicting.
This goal can clearly contribute to the usability of CE applications, to the extent that it relieves users of dealing with spurious conflicts.
However, some conflicts are not spurious, and I wonder if the CE community's focus on CRDTs has left the handling of true conflicts underdeveloped.

Here are some application sketches that illustrate true conflicts.

Consider a room reservation system.
Two users could attempt to concurrently reserve the same room for the same time.
One common idea is to resolve such conflicts in an arbitrary way (for example, users with longer names "win").
However, some applications might have more specific rules like priority levels for different events.

Consider asynchronous games like correspondence chess, diplomacy, etc.
If there were such a game that was not strictly turn-based it might be possible for multiple players to make conflicting moves concurrently.

Consider a political advocacy group that was sending volunteers out to talk with people at their homes.
Perhaps the volunteers could use smartphones to record which homes they visited, and before knocking on a door a user wants to be fairly sure that no other volunteer has visited that home before.


For example, consider a resource reservation system; two teammates should not be able to reserve the same resource for overlapping times.

When conflicting edits are a feature of some application, there are a handful of sane strategies.

- When a user performs a potentially conflicting operation, they have to wait for some strong kind of consensus.
This makes sense for some kinds of conflicts; you wouldn't want to launch the missiles based on an incorrect understanding of the database.
However, for some kinds of conflicts, it would be annoying to prevent an offline user from making further edits because of a potential editing conflict that could be resolved later.
- For very light conflicts (perhaps, change the background color to green vs yellow), it's probably best to let the user continue editing without any care for conflicts, resolving them later if necessary.
- There may be "medium" conflicts, where it's best for a user to wait for some amount of time or some amount of time, or some number of acknowledgments, but not necessarily enough to be sure

One way to organize all of this is to say that all teammates eventually agree on a total order for the operations, but they might not for some recent operations.
In other words, one teammate might be mistaken about the order of some number of recent operations.

When a teammate gets more information and is forced to reorder some of the operations in their copy of the team's database, there are several cases to consider.
The nicest case is that everything commutes, a la OT/CRDT.

A couple awkwardnesses to worry about:

