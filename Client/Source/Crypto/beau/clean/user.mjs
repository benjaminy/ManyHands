import * as my_crypto from "../clean/crypto_wrappers";

import assert from "assert";
import  WebCrypto from "node-webcrypto-ossl";
import TextEncoder from "text-encoding";

const WC = new WebCrypto();
const CS = WC.subtle;

export async function user(name, secret) {
    let u = {};
    u.name = name;
    u.conversations = {};
    return u;
}

export async function init_conversation(sender, reciever, shared_secret, reciever_keypair) {
    assert(typeof sender.name === "string");
    assert(typeof reciever.name === "string");
    assert(new DataView(shared_secret).byteLength === 32);

    assert(reciever_keypair.publicKey.algorithm.name === "ECDH");
    assert(reciever_keypair.publicKey.type === "public");
    assert(reciever_keypair.privateKey.algorithm.name === "ECDH");
    assert(reciever_keypair.privateKey.type === "private");


    sender.conversations[reciever.name] = {};
    await initialize_blank_keys(sender.conversations[reciever.name]);
    await init_sender_conversation(
        sender.conversations[reciever.name],
        shared_secret,
        reciever_keypair.publicKey
    );

    reciever.conversations[sender.name] = {};
    await initialize_blank_keys(reciever.conversations[sender.name]);
    await init_reciever_conversation(
        reciever.conversations[sender.name],
        shared_secret,
        reciever_keypair
    );
}

export async function initialize_blank_keys(conversation) {
    conversation.send_key = null;
    conversation.new_send_key = false;
    conversation.recieve_key = null;
    conversation.root_key = null;
    conversation.send_chain_key = null;
    conversation.recieve_chain_key = null;
}

export async function init_sender_conversation(conversation, secret_key, reciever_dh_public_key) {
    assert(conversation.root_key !== undefined);
    assert(new DataView(secret_key).byteLength === 32);
    assert(reciever_dh_public_key.algorithm.name === "ECDH");
    assert(reciever_dh_public_key.type === "public");

    conversation.send_key = await my_crypto.generate_dh_key();
    conversation.new_send_key = true;
    conversation.recieve_key = reciever_dh_public_key;

    let kdf_out = await my_crypto.root_kdf_step(
        secret_key,
        await my_crypto.derive_dh(conversation.recieve_key, conversation.send_key.privateKey)
    );

    conversation.root_key = kdf_out.root_key;
    conversation.send_chain_key = kdf_out.chain_key;
}

export async function init_reciever_conversation(conversation, secret_key, reciever_dh_keypair) {
    assert(conversation.root_key !== undefined);
    assert(new DataView(secret_key).byteLength === 32);
    assert(reciever_dh_keypair.publicKey.algorithm.name === "ECDH");
    assert(reciever_dh_keypair.publicKey.type === "public");
    assert(reciever_dh_keypair.privateKey.algorithm.name === "ECDH");
    assert(reciever_dh_keypair.privateKey.type === "private");

    conversation.send_key = reciever_dh_keypair;
    conversation.root_key = secret_key;
}
