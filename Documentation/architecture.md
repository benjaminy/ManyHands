Many Hands Architecture
=======================

This document is a snapshot of the underlying architecture of Many Hands circa late summer, 2015.

The core idea is that users of the system can belong to teams that share some database.
Each team member has a copy of the team's database stored encrypted in the cloud.
The main technical challenges of the system are making the data accessible to teammates without exposing it more broadly, and keeping the copies consistent with each other.

Each user's cloud storage directory looks like this (user "M" in this case):

<pre>
MH/public_key_M
  /salt_A
  /E( private_key_M, PBKD( uid, password, salt_A ) )
  /Team_Z/salt_Z
         /E( database_M_Z, key_Z )
         /Keys/E( key_Z, public_key_N )
              /E( key_Z, public_key_L )
              /E( key_Z, public_key_J )
              /...
  /Team_Y/salt_Y
         /E( database_M_Y, key_Y )
         /Keys/E( key_Z, public_key_P )
              /E( key_Z, public_key_Q )
              /E( key_Z, public_key_L )
              /...
  /...

key_Z = PBKD( private_key_M, salt_Z )
key_Y = PBKD( private_key_M, salt_Y )
</pre>
