import * as crypto from "./crypto_wrappers";

import assert from "assert";

const DEFAULT_PREKEY_NUM = 10;

export async function new_user(name) {
    const u = {};
    u.pub = {name: name, uid: name};
    u.priv = {};

    const init_keys = await generate_init_keys();
    u.pub = Object.assign(u.pub, init_keys.pub);
    u.priv = Object.assign(u.priv, init_keys.priv);

    u.pub.teams = {};
    u.priv.teams = {};

    u.pub.users = {};
    u.priv.users = {};

    return u;
}

export async function generate_init_keys() {
    const pub = {};
    const priv = {};

    const id_dh = await crypto.generate_dh_key();
    const id_dsa = await crypto.derive_dsa_key(id_dh);

    pub.id_dh = id_dh.publicKey;
    pub.id_dsa = id_dsa.publicKey;

    priv.id_dh = id_dh.privateKey;
    priv.id_dsa = id_dsa.privateKey;

    const prekey = await crypto.generate_dh_key();
    const signature = await crypto.sign_key(priv.id_dsa, prekey.publicKey);

    pub.prekey = prekey.publicKey;
    pub.prekey_signature = signature;

    priv.prekey = prekey.privateKey;

    pub.otpks = [];
    priv.otpks = [];

    for (let i = 0; i < DEFAULT_PREKEY_NUM; i++) {
        const new_prekey = await crypto.generate_dh_key();
        pub.otpks.push(new_prekey.publicKey);
        priv.otpks.push(new_prekey.privateKey);
    }

    return {pub: pub, priv: priv};
}


/*
In init_conversation_keys(), both the send chain and the recieve chain are
initialized to the same value. This is done because init conversation is
called by both senders and recievers. Senders will eventually reinitialize their
recieve chain, and recievers will evetually reinitialize their send chain.

*/
export async function init_conversation_keys(shared_secret) {
    assert(new DataView(shared_secret).byteLength > 0);

    let conversation = {}
    conversation.root_key = shared_secret;

    conversation.send_key = {publicKey: null, privateKey: null};
    conversation.recieve_key = null;
    conversation.new_send_key = true;

    const new_chainkey = await crypto.chain_kdf_step(conversation.root_key);

    conversation.send_chain_key = new_chainkey.chain_key;
    conversation.recieve_chain_key = new_chainkey.chain_key;

    return conversation;
}
