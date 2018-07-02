import * as dr from "./double_ratchet"
import * as crypto from "./crypto_wrappers"
import * as user from "./user"
import * as diffie from "./triple_dh"

import assert from "assert";
import WebCrypto from "node-webcrypto-ossl";
import TextEncoder from "text-encoding";

const Encoder = new TextEncoder.TextEncoder();
const Decoder = new TextEncoder.TextDecoder('utf-8');

const WC = new WebCrypto();
const CS = WC.subtle;

export async function send(sender, reciever_pub, message) {
    console.log("********SEND********");
    const message_header = {};
    message_header.sender_uid = sender.pub.uid;

    if (sender.priv.conversations[reciever_pub.uid] === undefined) {

        const diffie_out = await diffie.sender_triple_diffie_hellman(
            sender.priv.init_keys, reciever_pub.init_keys
        );

        message_header.ephemeral_public_key = diffie_out.ephemeral_public_key;
        message_header.sender_id_dh = sender.pub.init_keys.id_dh;

        sender.priv.conversations[reciever_pub.uid] = await user.init_conversation_keys(diffie_out.shared_secret);
        sender.priv.conversations[reciever_pub.uid].recieve_key = reciever_pub.init_keys.prekey;
    }


    const ratchet_out = await dr.ratchet_encrypt(
        sender.priv.conversations[reciever_pub.uid], message_header, message
    );

    const export_buffer = await form_message_buffer(ratchet_out.header, ratchet_out.cipher_text);

    reciever_pub.inbox.push(export_buffer);
}

export async function recieve_message(reciever) {
    console.log("********RECIEVE********");

    const message_buffer = reciever.pub.inbox.shift();
    const parsed_message = await parse_message_buffer(message_buffer);

    const sender_uid = parsed_message.header.sender_uid;

    if (reciever.priv.conversations[sender_uid] === undefined) {
        const sender_init_keys = parsed_message.header.sender_init_keys;

        const shared_secret = await diffie.reciever_triple_diffie_hellman(
            parsed_message.header.sender_id_dh,
            parsed_message.header.ephemeral_public_key,
            reciever.priv.init_keys
        );

        reciever.priv.conversations[sender_uid] = await user.init_conversation_keys(shared_secret);
        reciever.priv.conversations[sender_uid].send_key.publicKey = reciever.pub.init_keys.prekey;
        reciever.priv.conversations[sender_uid].send_key.privateKey = reciever.priv.init_keys.prekey;
    }

    let plain_text = await dr.ratchet_decrypt(
        reciever.priv.conversations[sender_uid], parsed_message.header, parsed_message.message_buffer
    );

    return plain_text;
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






//
// // How there is no way for this function to not take a whole reciever yet... not with naive internet
// export async function start_two_way_conversation(sender, reciever) {
//     let shared_secret = await my_crypto.random_secret();
//
//     let reciever_keypair = await my_crypto.generate_dh_key();
//
//     await my_user.init_conversation(sender, reciever, shared_secret, reciever_keypair);
//
//     let sender_send = [];
//     let sender_recieve = [];
//
//     sender.conversations[reciever.name].send_queue = sender_send;
//     sender.conversations[reciever.name].recieve_queue = sender_recieve;
//
//     reciever.conversations[sender.name].send_queue = sender_recieve;
//     reciever.conversations[sender.name].recieve_queue = sender_send;
//
//     let sender_dh = x3dh.sender_triple_diffie_hellman(sender_init_keys, reciever_init_key)
//
//     let shared_secret = sender_dh.shared_secret;
//     let key_to_send = sender_dh.ephemeral_public_key;
//
// }
//
// // TODO Have a start group party conversation which can call the two party conversation in loops.
// // TODO Have a two party start conversation
//
//
//
// // Have send be able start conversation as well, and pass in the user public object every time.
// export async function send(sender, recipient_name, message) {
//     assert(typeof sender.name === "string");
//     assert(typeof recipient_name === "string");
//     assert(typeof message === "string");
//
//     let encrypted_message = await double_ratchet.ratchet_encrypt(
//         sender.conversations[recipient_name], message
//     );
//
//     sender.conversations[recipient_name].send_queue.push(encrypted_message);
//
// }
//
// // TODO: implement single recieve function as well as the recieve all function.
// export async function recieve_all(recipient, sender_name) {
//     assert(typeof recipient.name === "string");
//     assert(typeof sender_name === "string");
//     let output = [];
//
//     while (recipient.conversations[sender_name].recieve_queue.length > 0) {
//         let plain_text = await recieve_message(recipient, sender_name);
//         output.push(plain_text)
//     }
//
//     return output;
// }
//
// export async function recieve_message(recipient, sender_name) {
//     assert(typeof recipient.name === "string");
//     assert(typeof sender_name === "string");
//     assert(recipient.conversations[sender_name].recieve_queue.length > 0);
//
//     let current_message = recipient.conversations[sender_name].recieve_queue.shift();
//     let plain_text = await double_ratchet.ratchet_decrypt(recipient.conversations[sender_name], current_message);
//
//     return plain_text;
//
// }
