import * as dr from "./double_ratchet"
import * as crypto from "./crypto_wrappers"
import * as user from "./user"
import * as diffie from "./triple_dh"
import storage from "../../../Storage/in_memory";

import assert from "assert";

const groups = {};

export function create_new_group(name, group_members_pub) {
    // The storage location needs to be initialized here
    console.log("I hope we are here!");
    const s = storage();
    groups[name] = [];
    for (let i = 0; i < group_members_pub.length; i++) {
        groups[name].push(group_members_pub[i]);
    };
}

export async function send_group_message(sender, group_name, message) {
    const base_message_header = {};

    base_message_header.sender_uid = sender.pub.uid;
    base_message_header.group_name = group_name;

    // cipher text is encrypted with message key
    const message_key = await crypto.random_secret();
    const cipher_text = await crypto.encrypt_text(message_key, message);

    for (let i = 0; i < groups[group_name].length; i++) {
        const group_member_pub = groups[group_name][i].pub

        if (group_member_pub.uid != sender.pub.uid) {
            const message_header = Object.assign({}, base_message_header);

            // initialing a conversation if one doesn't already exist and doing diffie hellman
            if (!(group_member_pub.uid in sender.priv.conversations)) {
                const diffie_out = await diffie.sender_triple_diffie_hellman(sender.priv, group_member_pub);

                message_header.ephemeral_public_key = diffie_out.ephemeral_public_key;
                message_header.sender_id_dh = sender.pub.id_dh;

                sender.priv.conversations[group_member_pub.uid] = await user.init_conversation_keys(diffie_out.shared_secret);
                // SETTING RECIEVE KEY
                sender.priv.conversations[group_member_pub.uid].recieve_key = group_member_pub.prekey;
            }

            message_header.sender_id_dsa = sender.pub.id_dsa;

            const ratchet_out = await dr.ratchet_encrypt(
                sender.priv.conversations[group_member_pub.uid], message_header, message_key
            );

            const export_buffer = await group_form_message_buffer(
                sender.priv.id_dsa, ratchet_out.header, ratchet_out.cipher_text, cipher_text
            );

            // THIS IS WHERE I WILL TRY TO UPLOAD THE FILES TO THE SIMPLE CLOUD SERVER
            group_member_pub.inbox.push(export_buffer);
        }
    }
}

export async function recieve_group_message(reciever) {
    const message_buffer = reciever.pub.inbox.shift();
    const parsed_message = await group_parse_message_buffer(message_buffer);

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

    const message_key = await dr.ratchet_decrypt(
        reciever.priv.conversations[sender_uid], parsed_message.header, parsed_message.message_key
    );

    const plain_text = await crypto.decrypt_text(message_key, parsed_message.message_buffer)

    return plain_text;
}

export async function group_form_message_buffer(private_dsa_key, header, message_key, message_buffer) {
    const message_header = Object.assign({}, header);

    if ("ephemeral_public_key" in header) {
        message_header.ephemeral_public_key = await crypto.export_dh_key(header.ephemeral_public_key);
    }

    if ("sender_id_dh" in header) {
        message_header.sender_id_dh = await crypto.export_dh_key(header.sender_id_dh);
    }

    if ("sender_id_dsa" in header) {
        message_header.sender_id_dsa = await crypto.export_dsa_key(header.sender_id_dsa);
    }

    if ("ratchet_key" in header) {
        message_header.ratchet_key = await crypto.export_dh_key(header.ratchet_key);
    }

    const header_buffer = crypto.encode_object(message_header);
    const header_size = new DataView(header_buffer).byteLength;
    const header_byte_size_buffer = new Uint32Array([header_size]).buffer;

    const data_to_sign = crypto.combine_buffers(
        [header_byte_size_buffer, header_buffer, message_key, message_buffer]
    )

    const signature = await crypto.sign(private_dsa_key, data_to_sign);
    const export_buffer = crypto.combine_buffers([signature, data_to_sign]);

    return export_buffer;
}

export async function group_parse_message_buffer(message_buffer) {
    let message_byte_array = new Uint8Array(message_buffer);
    const signature = message_byte_array.slice(0, 64).buffer;

    message_byte_array = message_byte_array.slice(64, message_byte_array.length);

    const header_byte_size = new Uint32Array(message_byte_array.slice(0, 4).buffer)[0];

    const header_byte_array = message_byte_array.slice(4, (header_byte_size + 4));
    const header = crypto.decode_object(header_byte_array.buffer);

    if ("ephemeral_public_key" in header) {
        header.ephemeral_public_key = await crypto.import_dh_key(header.ephemeral_public_key);
    }

    if ("sender_id_dh" in header) {
        header.sender_id_dh = await crypto.import_dh_key(header.sender_id_dh);
    }

    if ("sender_id_dsa" in header) {
        header.sender_id_dsa = await crypto.import_dsa_key(header.sender_id_dsa);
    }

    if ("ratchet_key" in header) {
        header.ratchet_key = await crypto.import_dh_key(header.ratchet_key);
    }

    await crypto.verify(header.sender_id_dsa, signature, message_byte_array.buffer);

    const key_buffer = message_byte_array.slice((header_byte_size + 4), (header_byte_size + 4 + 48)).buffer;
    const text_buffer = message_byte_array.slice((header_byte_size + 4 + 48), message_byte_array.length).buffer;


    return {header: header, message_key: key_buffer, message_buffer: text_buffer};
}
