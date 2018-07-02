import * as crypto from "./crypto_wrappers";

import assert from "assert";
import  WebCrypto from "node-webcrypto-ossl";
import TextEncoder from "text-encoding";

const WC = new WebCrypto();
const CS = WC.subtle;

export async function new_user(name) {
    const u = {};
    u.pub = {name: name, uid: name};
    u.priv = {};

    const init_keys = await generate_init_keys();
    u.pub.init_keys = init_keys.pub;
    u.priv.init_keys = init_keys.priv;

    u.pub.inbox = [];
    u.priv.conversations = {};

    return u;
}

export async function generate_init_keys() {
    const pub = {};
    const priv = {};

    const id_dh = await crypto.generate_dh_key();
    const id_dsa = await crypto.generate_dsa_key(id_dh);

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
    const number_of_one_time_prekeys = 10;

    for (let i = 0; i < number_of_one_time_prekeys; i++) {
        const new_prekey = await crypto.generate_dh_key();
        pub.otpks.push(new_prekey.publicKey);
        priv.otpks.push(new_prekey.privateKey);
    }

    return {pub: pub, priv: priv};
}

export async function init_conversation_keys(shared_secret) {
    assert(new DataView(shared_secret).byteLength > 0);

    let conversation = {}
    conversation.root_key = shared_secret;

    conversation.send_key = await crypto.generate_dh_key();
    conversation.recieve_key = null;
    conversation.new_send_key = true;

    const new_chainkey = await crypto.chain_kdf_step(conversation.root_key);

    conversation.send_chain_key = new_chainkey.chain_key;
    conversation.recieve_chain_key = new_chainkey.chain_key;

    return conversation;
}
