------
2018-6-5

biy. I think we can hack the export/import functions to use the same EC keys for DSA and DH.
Just need to monkey with the key_ops field.
Otherwise the format looks identical.

bwc. In order to sign a crypto_key, you must export it, then sign the stringified version of the key. 

bwc. In order you have to import a private key that is in jwk format, you must include the d: attribute.
Leaving it out and only using x: and y: will import the key as a public key.  

bwc. Why is typeof ArrayBuffer and object.... I can't get this.

bwc. Think ben mentioned this today, but I didn't write it down (facepalm).
But pbkdf2 derive bits doesn't work with aes-ctr, so I am using aes-cbc

bwc. when the double ratchet starts, you can assume that both alice and bob already have public keys.

------
2018-6-3

biy. Getting sensible async traces from node:  --trace-warnings

biy. Calls to "A" functions have to be yielded before the next call to an "A" function.
Otherwise the stack gets messed up.
Maybe just live with this as an annoyance.
Possible follow-ups:
1. Force callers to insert yield implicitly. Don't think this is possible. Maybe Proxy/Reflect.
2. Implicitly spawn on 2nd, 3rd, etc calls. This seems super messy, but maybe not.

------
2018-6-2

biy. node --experimental-modules

------
2018-5-30

biy. Reminder: It's tempting to put the key for the next transaction in the transaction chain itself.
This would eliminate the need for making a key copy for each teammate for every transaction.
But this would damage forward secrecy, because the keys would no longer be ephemeral.
It's debatable how important forward secrecy is, because the database is always there.
But I think it's still an important feature, at least because in principle it's possible to purge data from the database.

bwc. Attempting to understand the double ratchet algorithm is tricky because it is utilizing some capabilities of the DH algorithm that I am not fully familiar with.
The nature of DH Ratchet algorithms "ping pong behavior" of replacing ratchet key pairs seems interesting at 50,000 feet. But makes little to no sense when my feet are on the ground.
I guess the part that is most confusing as of now is the importance or significance of the DH output that is generated at every step.

bwc. Trying to understand DH at a deeper level, so I went to Ferguson. Working through it slowly. Primes are annoying.

bwc. Primes are still annoying. I started reading through Sporc Documentation. The initial part of their paper primarily concerns Operation Consistency and fork consistency.
Curious how these relate to the many hands project.

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
