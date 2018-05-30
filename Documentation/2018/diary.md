------
2018-5-30

biy. Reminder: It's tempting to put the key for the next transaction in the transaction chain itself.
This would eliminate the need for making a key copy for each teammate for every transaction.
But this would damage forward secrecy, because the keys would no longer be ephemeral.
It's debatable how important forward secrecy is, because the database is always there.
But I think it's still an important feature, at least because in principle it's possible to purge data from the database.

------
2018-5-29

bwc. Working through the X3DH Key agreement protocol from signal.
Feeling as if I am missing the forest for the trees.
The concept specifically behind the ephemeral keys and the prekeys is particularly elusive to me.
I find these concepts particularly confusing at the point when alice receives the prekey bundle from bob.
I think it would be useful to look at X3DH from the view of the attacks it tries to prevent, because without that insight, this seems superfluous.
Feeling like I was lacking the bigger picture, I moved to reading the ferguson cryptography engineering book for a better big picture understanding of key agreement.

------
2018-5-18

biy. Working on the storage wrappers.
Thinking about best way to pass keys and such up and down.
Decided t0 generalize the "path" to a "file pointer" that includes the path, keys, iv, maybe more?

------
