import * as crypto from "../clean/crypto_wrappers";

import assert from "assert";
import WebCrypto from "node-webcrypto-ossl";

const WC = new WebCrypto();
const CS = WC.subtle;

export async function ratchet_encrypt(sender_conversation, header, plain_text) {
    assert(sender_conversation.root_key !== undefined);
    assert(typeof plain_text === "string");

    const message_header = Object.assign(header);

    if (sender_conversation.new_send_key) {
        sender_conversation.send_key = await crypto.generate_dh_key();

        let send_ratchet_seed = await crypto.derive_dh(
            sender_conversation.recieve_key,
            sender_conversation.send_key.privateKey
        );

        let send_root_step = await crypto.root_kdf_step(
            sender_conversation.root_key,
            send_ratchet_seed
        );

        sender_conversation.root_key = send_root_step.root_key;
        sender_conversation.send_chain_key = send_root_step.chain_key;

        message_header.ratchet_key = sender_conversation.send_key.publicKey;
        sender_conversation.new_send_key = false;
    }

    const chain_kdf = await crypto.chain_kdf_step(sender_conversation.send_chain_key);
    sender_conversation.send_chain_key = chain_kdf.chain_key;

    const cipher_text = await crypto.encrypt_text(sender_conversation.send_chain_key, plain_text);

    return {cipher_text: cipher_text, header: message_header};
}

export async function ratchet_decrypt(reciever_conversation, message_header, message_buffer) {
    let header = Object.assign(message_header);
    if (header.ratchet_key) {
        // need to increment the recieve chain using the current sent key.
        reciever_conversation.recieve_key = header.ratchet_key;

        let receive_ratchet_seed = await crypto.derive_dh(
            reciever_conversation.recieve_key,
            reciever_conversation.send_key.privateKey
        );

        let recieve_root_step = await crypto.root_kdf_step(
            reciever_conversation.root_key,
            receive_ratchet_seed
        );

        reciever_conversation.root_key = recieve_root_step.root_key;
        reciever_conversation.recieve_chain_key = recieve_root_step.chain_key;

        // need to create new send_key;
        reciever_conversation.new_send_key = true;

    }

    let chain_kdf = await crypto.chain_kdf_step(reciever_conversation.recieve_chain_key);

    reciever_conversation.recieve_chain_key = chain_kdf.chain_key;

    let plain_text = await crypto.decrypt_text(
        chain_kdf.message_key,
        message_buffer
    );

    return plain_text;
}
