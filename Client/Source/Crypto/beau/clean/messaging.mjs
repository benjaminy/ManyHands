import * as dr from "./double_ratchet"
import * as crypto from "./crypto_wrappers"
import * as user from "./user"
import * as diffie from "./triple_dh"

import assert from "assert";

const groups = {};

export async function send(sender, reciever_pub, message) {
    const message_header = {};
    message_header.sender_uid = sender.pub.uid;

    if (!(reciever_pub.uid in sender.priv.conversations)) {
        const diffie_out = await diffie.sender_triple_diffie_hellman(sender.priv, reciever_pub);

        message_header.ephemeral_public_key = diffie_out.ephemeral_public_key;
        message_header.sender_id_dh = sender.pub.id_dh;

        sender.priv.conversations[reciever_pub.uid] = await user.init_conversation_keys(diffie_out.shared_secret);
        sender.priv.conversations[reciever_pub.uid].recieve_key = reciever_pub.prekey;
    }

    const ratchet_out = await dr.ratchet_encrypt(
        sender.priv.conversations[reciever_pub.uid], message_header, message
    );

    const export_buffer = await form_message_buffer(ratchet_out.header, ratchet_out.cipher_text);

    reciever_pub.inbox.push(export_buffer);
}

export async function recieve_message(reciever) {
    const message_buffer = reciever.pub.inbox.shift();
    const parsed_message = await parse_message_buffer(message_buffer);

    const sender_uid = parsed_message.header.sender_uid;

    if (!(sender_uid in reciever.priv.conversations)) {
        const sender_init_keys = parsed_message.header.sender_init_keys;

        const shared_secret = await diffie.reciever_triple_diffie_hellman(
            parsed_message.header.sender_id_dh,
            parsed_message.header.ephemeral_public_key,
            reciever.priv
        );

        const conv = await user.init_conversation_keys(shared_secret);
        conv.send_key.publicKey = reciever.pub.prekey;
        conv.send_key.privateKey = reciever.priv.prekey;
        reciever.priv.conversations[sender_uid] = conv;
    }

    let plain_text = await dr.ratchet_decrypt(
        reciever.priv.conversations[sender_uid], parsed_message.header, parsed_message.message_buffer
    );

    return plain_text;
}

export function create_new_group(name, group_members_pub) {
    groups[name] = [];
    for (let i = 0; i < group_members.length; i++) {
        groups[name].push(group_members_pub.uid);
    };
}

export async function form_message_buffer(header, message_buffer) {
    const message_header = Object.assign(header);

    if (header.ephemeral_public_key !== undefined) {
        message_header.ephemeral_public_key = await crypto.export_dh_key(header.ephemeral_public_key);
    }

    if (header.sender_id_dh !== undefined) {
        message_header.sender_id_dh = await crypto.export_dh_key(header.sender_id_dh);
    }

    if (header.ratchet_key !== undefined) {
        message_header.ratchet_key = await crypto.export_dh_key(header.ratchet_key);
    }

    const header_buffer = crypto.encode_object(message_header);
    const header_size = new DataView(header_buffer).byteLength;
    const header_byte_size_buffer = new Uint32Array([header_size]).buffer;

    const export_buffer = crypto.combine_buffers(
        [header_byte_size_buffer, header_buffer, message_buffer]
    )

    // const signature = await crytpo.sign(id_dsa, export_buffer);

    return export_buffer;
}

export async function parse_message_buffer(message_buffer) {
    const message_byte_array = new Uint8Array(message_buffer);
    const header_byte_size = new Uint32Array(message_byte_array.slice(0, 4).buffer)[0];

    const header_byte_array = message_byte_array.slice(4, (header_byte_size + 4));
    const header = crypto.decode_object(header_byte_array.buffer);
    if (header.ephemeral_public_key !== undefined) {
        header.ephemeral_public_key = await crypto.import_dh_key(header.ephemeral_public_key);
    }

    if (header.sender_id_dh !== undefined) {
        header.sender_id_dh = await crypto.import_dh_key(header.sender_id_dh);
    }

    if (header.ratchet_key !== undefined) {
        header.ratchet_key = await crypto.import_dh_key(header.ratchet_key);
    }

    const text_buffer = message_byte_array.slice((header_byte_size + 4), message_byte_array.length).buffer;

    return {header: header, message_buffer: text_buffer};
}
