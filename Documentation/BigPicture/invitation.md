Alice wants to invite Bob to team T
Two cases to consider:
1. Alice already knows where Bob's UWS storage is
2. Alice does not know ...

Case 1: Alice already knows where Bob's UWS storage is

TBD

Case 2: Alice does not know ...

1. Alice makes an invitation
    - Generate unique invitation ID (ID<sub>IA</sub>)
    - Generate ephemeral key-pair (EK<sub>A</sub>); Save in personal DBs
    - Save meta info about the invitation in private personal DB
    - Save the following in [Cloud<sub>A</sub>]/Invitations/ID<sub>IA</sub>\_step1 (unencrypted, signed):
        - Ptr to current identity key (IK<sub>A</sub>)
        - Ptr to EK<sub>A</sub>
    - Send to Bob (unsecured):
        - Link to [Cloud<sub>A</sub>]
        - ID<sub>IA</sub>
        - The number of team members, N<sub>T</sub> (or some random(ish) number bigger than that)
        - Additional notes, if desired
2. Bob accepts the invitation
    - Generate N<sub>T</sub> ephemeral key-pairs (EK<sub>B-A</sub>, EK<sub>B-C</sub>, EK<sub>B-D</sub>, ...); Save in personal DBs
    - Generate prekey PK<sub>B-T</sub>
    - Generate invitation ID (ID<sub>IB</sub>)
    - Generate personal team location LOC<sub>B-T</sub>
    - Save meta info about the invitation in private personal DB
    - Compute SK = KDF( ( DH( EK<sub>A</sub>, IK<sub>B</sub> ) || DH( IK<sub>A</sub>, EK<sub>B-A</sub> ) || DH( EK<sub>A</sub>, EK<sub>B-A</sub> ) ) )
    - Save the following in [Cloud<sub>B</sub>]/Invitations/ID\_IB\_step2a (unencrypted, signed):
        - Ptr to current identity key (IK<sub>B</sub>)
        - Ptr to EK<sub>B-A</sub>
    - Save the following in [Cloud<sub>B</sub>]/Invitations/ID\_IB\_step2b (encrypted with SK):
        - ID<sub>IA</sub>
        - LOC<sub>B-T</sub>
        - PK<sub>B-T</sub>
        - EK<sub>B-C</sub>, EK<sub>B-D</sub>, ...
    - Send to Alice (unsecured):
        - Link to [Cloud<sub>B</sub>]
        - ID<sub>IB</sub>
3. Alice adds Bob to the team
    - Compute SK = KDF( ( DH( EK<sub>B-A</sub>, IK<sub>A</sub> ) || DH( IK<sub>B</sub>, EK<sub>A</sub> ) || DH( EK<sub>B-A</sub>, EK<sub>A</sub> ) ) )
    - Generate UID<sub>B-T</sub>
    - For each other teammate (C, D, ...), pick a one-time prekey key OPK<sub>C-x</sub>, OPK<sub>D-x</sub>, ...
        - If the supply of such keys has run out ... ??? just leave it out???
    - Update team DB
    - Save the following in [Cloud<sub>A</sub>]/Invitations/ID<sub>IA</sub>\_step3 (encrypted with SK):
        - ID<sub>IB</sub>
        - LOC<sub>A-T</sub>
        - UID<sub>B-T</sub>
        - Any keys needed to decrypt DB<sub>A-T</sub>
4. Bob joins the team
    - Copy DB from Alice
    - Delete EK<sub>B-A</sub>
    - Delete [Cloud<sub>B</sub>]/Invitations/ID<sub>IB</sub>\_*
    - Delete meta information about the invitation from personal DB
5. Alice cleans up
    - Delete EK<sub>A</sub>
    - Delete [Cloud<sub>A</sub>]/Invitations/ID<sub>IA</sub>\_*
    - Delete meta information about the invitation from personal DB
    - Rotate keys for DB<sub>A-T</sub>
