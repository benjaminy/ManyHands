import * as crypto from "../clean/crypto_wrappers";

import assert from "assert";

export async function ratchet_encrypt(sender_conversation, header, message_buffer) {
    assert(sender_conversation.root_key !== undefined);
    assert(new DataView(message_buffer).byteLength > 0);

    const message_header = Object.assign({}, header);

    if (sender_conversation.new_send_key) {
        const ratchet_out = await sender_ratchet_step(sender_conversation);
        sender_conversation = Object.assign(sender_conversation, ratchet_out);

        message_header.ratchet_key = sender_conversation.send_key.publicKey;
    }

    const chain_kdf = await crypto.chain_kdf_step(sender_conversation.send_chain_key);
    sender_conversation.send_chain_key = chain_kdf.chain_key;

    const cipher_text = await crypto.encrypt_buffer(sender_conversation.send_chain_key, message_buffer);

    return {cipher_text: cipher_text, header: message_header};
}

export async function sender_ratchet_step(sender_conversation) {
    const send_key = await crypto.generate_dh_key();

    let send_ratchet_seed = await crypto.derive_dh({
        publicKey: sender_conversation.recieve_key,
        privateKey: send_key.privateKey
    });

    let send_root_step = await crypto.root_kdf_step(
        sender_conversation.root_key,
        send_ratchet_seed
    );

    const root_key = send_root_step.root_key;
    const chain_key = send_root_step.chain_key;

    return {
        send_key: send_key,
        root_key: send_root_step.root_key,
        send_chain_key: send_root_step.chain_key,
        new_send_key: false
    };
}

export async function ratchet_decrypt(reciever_conversation, message_header, message_buffer) {
    const header = Object.assign({}, message_header);

    if (header.ratchet_key) {
        reciever_conversation.recieve_key = header.ratchet_key;

        const ratchet_out = await reciever_ratchet_step(reciever_conversation);
        reciever_conversation = Object.assign(reciever_conversation, ratchet_out);
    }

    let chain_kdf = await crypto.chain_kdf_step(reciever_conversation.recieve_chain_key);

    reciever_conversation.recieve_chain_key = chain_kdf.chain_key;
    let decryption = await crypto.decrypt(chain_kdf.message_key, message_buffer);

    return decryption;
}

export async function reciever_ratchet_step(reciever_conversation) {
    reciever_conversation.recieve_key.usages = ['deriveKey', 'deriveBits'];

    const receive_ratchet_seed = await crypto.derive_dh({
        publicKey: reciever_conversation.recieve_key,
        privateKey: reciever_conversation.send_key.privateKey
    });

    const recieve_root_step = await crypto.root_kdf_step(
        reciever_conversation.root_key,
        receive_ratchet_seed
    );

    return {
        root_key: recieve_root_step.root_key,
        recieve_chain_key: recieve_root_step.chain_key,
        new_send_key: true
    }
}
