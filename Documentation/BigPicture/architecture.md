United We Stand Architecture
=======================

This document is a snapshot of the architecture of United We Stand circa summer, 2018.

The big-picture goals of the UWS protocol are described in the elevator_pitch document.

UWS is a meta-protocol composed of the following parts:

- A secure communications protocol (e.g. Signal)
- A broadcast communications infrastructure (e.g. cloud storage)
- A message order consistency protocol (e.g. ???)
- A data storage format (e.g. Datomic)

## Communication Protocol

In order for a team to collaborate on some document/database, they clearly need some way to communicate with each other.
The current UWS prototype uses a lightly adapted version of the Signal protocol for the encryption and authentication features of communication.

## Communication Medium

Existing messaging apps use central servers for relaying and buffering messages.
This is problematic for reasons discussed in the threat_model document.

The core entities in the system are users and teams.
Users can belong to any number of teams.
Each team has some shared document/database (or a collection, of docs/DBs, whatever).
Each user has a personal cloud storage account to which they have full permissions and everyone else in the world has read permissions.
Users upload their transactions that modify their team's DB to their cloud account encrypted such that only their team members can decrypt.
Team members use a distributed protocol to maintain a consistent view of the whole database.

There is a single file in each user's cloud directory called "root".
It contains links to other dynamically generated files.
Whenever a user want to change anything stored about themselves or any of their teams, that involves making new files and linking back up to the root, a la functional data structures.
This allows for some degree of sanity in a distributed system with no smart server.

root:
  login salt
  ptr to user public DB
  ptr to user private DB

user public DB:
  public keys
  ptrs to team roots
  signed certs???

user private DB:
  private keys
  access token???

team root:
  ptr to txns
  ptr to private DB
  salt???

login key = PBKD( uid, password, login salt )

Here's a translation of all of that into prose.
When a user joins Many Hands they need the following:
- A user ID (uid)
- A password
- A public/private key pair
- Team directories

The user can either provide their own keys or the system can generate them during registration.
In M's top level MH directory is M's public key, M's salt value and M's encrypted private key.
The private key is encrypted with a symmetric cipher using a key that is derived from M's uid, password and salt.
The private key is stored in the cloud so that users can access the system from anywhere without carrying their key around with them.
This could be considered a weakness of the system; we are relying on the encryption to keep the private key safe.

PBKD is password-based key derivation.
It is a special hash function that is design to take a relatively long time to compute to make password guessing attacks harder.

Next we see a directory for each team that M belongs to.
Each team directory contains:
- M's encrypted copy of the team's data
- M's salt value for that team
- Key directories

M's copy of team Z's data is encrypted with a key derived from M's private key and M's salt for team Z.
This key (key<sup>Z</sup><sub>M</sub>) is very important; it is the final barrier between the private data and the world.
M's salt for team Z is encrypted with M's (symmetric) key for good measure.

The keys directory contains a copy of key<sup>Z</sup><sub>M</sub> for each member of team Z.
These copies are each encrypted with the respective teammate's public key.

Note: Each user's cloud storage should be readable and writable by that user (of course).
The system is designed such that all data can be world-readable without exposing (unencrypted) private information.
If available, permissions systems could be used to restrict the set of agents that can read various files/directories; this is not essential to the functioning of the system, however.

Note: We should consider encrypting the team keys with something more complicated than just each user's public key.
In very large teams this could give an attacker a large amount of ciphertext encrypted with a single public key.

Note: The current architecture exposes the identity of the teams that a user belongs to.
This doesn't feel like a huge problem.
However, if we decide to later on it should not be hard to hash the team directory names.
There would need to be some mechanism for communicating this to teammates.

#### Example Workflows

### Registration



DON'T KNOW WHERE TO PUT THIS

In order to make collaborative editing applications more secure and private, make them more decentralized/peer-to-peer.
Maintaining some reasonable notion of consistency for the team's document/database becomes a challenging problem.

This problem is clearly closely related to the classic database problem of making database replicas for the purpose of fault tolerance, high throughput, and/or low latency for geographically distributed clients.
However, I think the constraints are quite different, which might make different solutions more desirable.

One issue that is important for the P2P collaborative editing context is that some teams may have quite intermittent connections to the internet.
In the extreme, team members may never be simultaneous online.
This means that offline editing is a central feature of any reasonable architecture.
Also, we need some mechanism for getting messages between teammates, even when they are not online simultaneously.

...

One family of technologies that has been used quite widely for collaborative editing is operational transformation (OT) and conflict-free replicated data types (CRDTs).
These ideas are interesting, but in their simplest form, they have an important problem.
Concrrent operations are simply not allowed to conflict with each other.
But in many applications, there are application-level operations that intrinsically conflict; if users perform these operations while offline, there is no simple way to silently merge them when the users get back online.
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

