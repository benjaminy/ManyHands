import  WebCrypto from "node-webcrypto-ossl";
import TextEncoder from "text-encoding";

const Encoder = new TextEncoder.TextEncoder();
const Decoder = new TextEncoder.TextDecoder('utf-8');

const WC = new WebCrypto();
const CS = WC.subtle;


/*
send and reciever

recieve()
    if this contains anew public key
        step ratchet


Ratchet() -- some storage of keys...
    put this key in the user object.


state of the conversation
    -- how do you capture that?

    -- What is the current
    root key
    -- allows alice and bob to only have to track their view of the world.
    send key
    recieve key.

    Ratchet step
        -- generating





In the future:
    we have users, and seperate of that, we have conversations.
        - and for that each conversation we have other users who we participate with.
        - In the future we have teams.

messages really going back and forth are just json objects
--

how should I handle exceptions
    Throw error Error class in javascript

*/
