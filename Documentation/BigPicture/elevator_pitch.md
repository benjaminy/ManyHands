The goal of the United We Stand (UWS) project is to provide a security- and privacy-preserving infrastructure for collaborative editing applications.
Collaborative editing applications like Google Docs, Slack, Trello, Asana, Evernote, ... are quite popular tools to help teams of people work and socialize together.
A major issue with these apps today is that they rely on central servers that receive edits from clients and integrate them into shared documents/databases.
These central servers become clear targets for all sorts of security and privacy related attacks.

UWS is an end-to-end encrypted protocol that lets developers build apps like the ones listed above with better security and privacy protection.
As a first step in seeing how UWS does this, you can imagine using an existing secure messaging protocol (Signal, WhatsApp, Telegram, Threema, etc.) to broadcast edits to teammates, instead of sending them to a central server.
The next level of detail about how UWS works is in the architecture document.

Compared to existing secure messaging protocols, UWS uses a more distributed architecture as a counter to some known problems.
Though existing E2EE messaging systems seem to a good job of protecting users' communications, they are still vulnerable to a variety of attacks: metadata collection, blocking by governments and legal attacks related to key disclosure laws.
The UWS protocol is design to minimize the risk of these kinds of attacks.

As of summer 2018, UWS is still in an early stage of development, but the basic architecture is stabilized and work is underway on a functional prototype.
