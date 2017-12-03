UWS should be reasonably tolerant of users being disconnected for substantial chunks of time.
It seems reasonably clear (don't have a proof) that this implies the data model should focus on accumulating transactions that can be merged later.
Conflicts between concurrent changes must be noticed, and hopefully can be marged without user intervention in many cases.

One subtle difference between UWS and related distributed database stuff, is the reliance on cloud storage that we assume to be reasonably reliable and responsive.
So if a user is disconnected from the internet, once they reconnect it's their responsibility to merge concurrent edits before uploading their own transactions.
However, once a user gets transactions uploaded to the cloud, after some small amount of time it becomes other users' responsibility to merge those transactions.

Of course there can still be ships passing in the night, so there needs to be a fancy merging/agreement protocol.

