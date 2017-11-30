Many Hands Architecture
=======================

This document is a snapshot of the underlying architecture of Many Hands circa late summer, 2015.

The core idea is that users of the system can belong to teams that share some database.
Each team member has a copy of the team's database stored encrypted in the cloud.
The main technical challenges of the system are making the data accessible to teammates without exposing it more broadly, and keeping the copies consistent with each other.

Each user's cloud storage directory looks like this (user "M" in this case):

in public DB:
  /public_key_M
  /salt_M
  /links to teams
  /

in private DB:
  /E( private_key_M, key_M )
  /E( access_token_M, key_M )

<pre>
MH/public\_root
  /private\_root
  /Public/ ... public DB ...
  /Private/ ... private DB ...
  /Team_X/public\root
         /Public
         /Private
         /Txns
         /E( salt_M_Z, key_M )
         /E( database_M_Z, key_M_Z )
         /Keys/E( key_M_Z, public_key_N )
              /E( key_M_Z, public_key_L )
              /E( key_M_Z, public_key_J )
              /...
  /...

key_M   = PBKD( uid, password, salt_M )
key_M_Z = PBKD( private_key_M, salt_M_Z )
key_M_Y = PBKD( private_key_M, salt_M_Y )
</pre>

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
