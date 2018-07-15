import * as dr from "./double_ratchet"
import * as crypto from "./crypto_wrappers"
import * as user from "./user"
import * as diffie from "./triple_dh"

import assert from "assert";

const groups = {};

export async function create_user_message(sender_conversation, message_header, message_buffer) {
    assert(new DataView(sender_conversation.root_key).byteLength > 0);
    assert(new DataView(message_buffer).byteLength > 0);

    // lets call ratchet encrypt and see what happens.
    const ratchet_out = await dr.ratchet_encrypt(sender_conversation, message_header, message_buffer)

    const export_buffer = await form_sender_buffer(ratchet_out.header, ratchet_out.cipher_text);
    return export_buffer;
}

export async function form_sender_buffer(header, cipher_text) {
    const message_header = Object.assign({}, header);

    if ("ratchet_key" in message_header) {
        message_header.ratchet_key = await crypto.export_dh_key(message_header.ratchet_key);
    }


    const header_buffer = await crypto.encode_object(message_header);
    const header_size = new DataView(header_buffer).byteLength;
    const header_size_buffer = new Uint32Array([header_size]).buffer;

    const export_buffer = await crypto.combine_buffers([header_size_buffer, header_buffer, cipher_text]);

    return export_buffer;
}

export async function parse_user_message(reciever_conversation, message_buffer) {
    assert(new DataView(message_buffer).byteLength > 0);
    const parsed_buffer = await parse_message_buffer(message_buffer);

    const message_header = parsed_buffer.header;
    const cipher_text = parsed_buffer.cipher_text;
    const dr_out = await dr.ratchet_decrypt(reciever_conversation, message_header, cipher_text);

    return {header: message_header, message: dr_out};
}

export async function parse_message_buffer(message_buffer) {
    const typed_message_buffer = new Uint8Array(message_buffer);
    const total_length = typed_message_buffer.length;
    const header_size = new Uint32Array(typed_message_buffer.slice(0, 4).buffer)[0];

    const header = await crypto.decode_object(
        typed_message_buffer.slice(4, (4 + header_size)).buffer
    );

    if ("ratchet_key" in header) {
        header.ratchet_key = await crypto.import_dh_key(header.ratchet_key);
    }

    const cipher_text = typed_message_buffer.slice((4 + header_size), total_length).buffer;

    return {header: header, cipher_text: cipher_text};
}
