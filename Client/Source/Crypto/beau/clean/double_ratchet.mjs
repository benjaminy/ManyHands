import * as my_crypto from "../clean/crypto_wrappers";

import assert from "assert";
import WebCrypto from "node-webcrypto-ossl";

const WC = new WebCrypto();
const CS = WC.subtle;

export async function ratchet_encrypt(sender_conversation, plain_text) {
    assert(sender_conversation.root_key !== undefined);
    assert(typeof plain_text === "string");

    let message_header = {}

    if (sender_conversation.new_send_key) {
        message_header = await my_crypto.form_header(sender_conversation.send_key.publicKey);
        sender_conversation.new_send_key = false;
    }

    let chain_kdf = await my_crypto.chain_kdf_step(sender_conversation.send_chain_key);
    sender_conversation.send_chain_key = chain_kdf.chain_key;

    let message_buffer = await my_crypto.form_message_buffer(
        chain_kdf.message_key,
        message_header,
        plain_text
    );

    return message_buffer;
}

export async function ratchet_decrypt(reciever_conversation, message_buffer) {

    assert(reciever_conversation.root_key !== undefined);
    assert(new DataView(message_buffer).byteLength >= 36);

    let parsed_message = await my_crypto.parse_message_buffer(message_buffer);

    let signature = parsed_message.signature;
    let signed_data = parsed_message.signed_data;
    let cipher_text = parsed_message.cipher_text;

    let header = await my_crypto.parse_header(parsed_message.header);

    if (header.public_key) {
        // need to increment the recieve chain using the current sent key.
        reciever_conversation.recieve_key = header.public_key;

        let foo_key = reciever_conversation.send_key.privateKey;

        let receive_ratchet_seed = await my_crypto.derive_dh(
            reciever_conversation.recieve_key,
            reciever_conversation.send_key.privateKey
        );

        let recieve_root_step = await my_crypto.root_kdf_step(
            reciever_conversation.root_key,
            receive_ratchet_seed
        );
        reciever_conversation.root_key = recieve_root_step.root_key;
        reciever_conversation.recieve_chain_key = recieve_root_step.chain_key;

        // need to create new send_key;
        reciever_conversation.new_send_key = true;
        reciever_conversation.send_key = await my_crypto.generate_dh_key();

        let send_ratchet_seed = await my_crypto.derive_dh(
            reciever_conversation.recieve_key,
            reciever_conversation.send_key.privateKey
        );

        let send_root_step = await my_crypto.root_kdf_step(
            reciever_conversation.root_key,
            send_ratchet_seed
        );
        reciever_conversation.root_key = send_root_step.root_key;
        reciever_conversation.send_chain_key = send_root_step.chain_key;

    }

    let chain_kdf = await my_crypto.chain_kdf_step(reciever_conversation.recieve_chain_key);

    reciever_conversation.recieve_chain_key = chain_kdf.chain_key;

    await my_crypto.verify(
        chain_kdf.message_key,
        signature,
        signed_data
    );


    let plain_text = await my_crypto.decrypt_text(
        chain_kdf.message_key,
        cipher_text
    );

    return plain_text;
}
