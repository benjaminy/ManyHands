import * as dr from "./double_ratchet"
import * as crypto from "./crypto_wrappers"
import * as user from "./user"
import * as user_messaging from "./user_messaging"
import * as diffie from "./triple_dh"

import assert from "assert";

const groups = {};

export async function create_new_team(group_name, group_members) {
    const new_group = {};

    new_group[group_name] = [];

    // initializing curr memebrs pub and priv group variables
    // need to initialize the members with a triple diffie hellman too.

    for (let i = 0; i < group_members.length; i++) {
        const curr_member = group_members[i];
        const pub1 = curr_member.pub;
        const priv1 = curr_member.priv;

        new_group[group_name].push(pub1.uid);

        pub1.teams[group_name] = {};
        pub1.teams[group_name].outbox = [];

        priv1.teams[group_name] = {};
        priv1.teams[group_name].timestamp = {};
        priv1.teams[group_name].timestamp[pub1.uid] = 0;

        priv1.teams[group_name].counter = 0;
        priv1.teams[group_name].members = [];
        priv1.teams[group_name].log = [];


        pub1.users[group_name] = {};
        // priv1.users[group_name] = {};


        for (let j = 0; j < group_members.length; j++) {
            if (i != j) {
                const other_member = group_members[j]
                const pub2 = other_member.pub;
                const priv2 = other_member.priv;

                priv1.teams[group_name].timestamp[pub2.uid] = 0;

                pub1.users[group_name][pub2.uid] = {};
                pub1.users[group_name][pub2.uid].outbox = [];

                priv1.teams[group_name].members.push(pub2);
                // need to do a tiple diffie hellman with them to fill the conversation keys


                if (i < j) {
                    const sender_diffie_out = await diffie.sender_triple_diffie_hellman(priv1, pub2);
                    const sender_shared_secret = sender_diffie_out.shared_secret;
                    const sender_ephemeral_key = sender_diffie_out.ephemeral_public_key;

                    const new_key = await crypto.generate_dh_key();

                    // Sender conversation gets initialized
                    const sender_conversation = await user.init_conversation_keys(sender_shared_secret);

                    // Sender recieve key gets set to the reciever prekey
                    sender_conversation.recieve_key = pub2.prekey;

                    // Sender Send key gets set to the newly generated dh_key
                    sender_conversation.send_key.publicKey = new_key.publicKey;
                    sender_conversation.send_key.privateKey = new_key.privateKey;

                    if (!(group_name in priv1.users)) {
                        priv1.users[group_name] = {};
                    }
                    priv1.users[group_name][pub2.uid] = {};
                    priv1.users[group_name][pub2.uid].conversation = sender_conversation;


                    // Reciever conversation gets intialized
                    const reciever_shared_secret = await diffie.reciever_triple_diffie_hellman(
                        pub1.id_dh, sender_ephemeral_key, priv2
                    );
                    const reciever_conversation = await user.init_conversation_keys(reciever_shared_secret);

                    // Reciever send key is set to their prekey
                    reciever_conversation.send_key.publicKey = pub2.prekey;
                    reciever_conversation.send_key.privateKey = priv2.prekey;

                    // Reciever recieve key is set to the newly generated key
                    reciever_conversation.recieve_key = new_key.publicKey;

                    if (!(group_name in priv2.users)) {
                        priv2.users[group_name] = {};
                    }
                    priv2.users[group_name][pub1.uid] = {};
                    priv2.users[group_name][pub1.uid].conversation = reciever_conversation;

                    assert(new Uint32Array(sender_shared_secret)[0] === new Uint32Array(reciever_shared_secret)[0]);

                }
            }
        }
    };

    Object.assign(groups, new_group);
    return new_group;
}

export async function upload_team_message(sender, group_name, message_to_send) {
    // Increment counter
    sender.priv.teams[group_name].timestamp[sender.pub.uid] += 1;

    const message_timestamp = Object.assign({}, sender.priv.teams[group_name].timestamp);

    const timestamp_buffer = await crypto.encode_object(message_timestamp);
    const timestamp_size = new Uint32Array([new DataView(timestamp_buffer).byteLength]).buffer;

    const message_buffer = await crypto.encode_string(message_to_send);

    const message_to_encrypt = await crypto.combine_buffers(
        [timestamp_size, timestamp_buffer, message_buffer]
    );

    const random_key = await crypto.random_secret();

    const cipher_text = await crypto.encrypt_buffer(random_key, message_to_encrypt);

    sender.pub.teams[group_name].outbox.push(cipher_text);
    const current_message_index = sender.pub.teams[group_name].outbox.length - 1;

    const team_members = sender.priv.teams[group_name].members;

    for (let i = 0; i < team_members.length; i++) {
        const current_group_member_name = team_members[i].uid;
        const sender_conversation = sender.priv.users[group_name][current_group_member_name].conversation

        const user_message = await user_messaging.create_user_message(
            sender_conversation, {message_index: current_message_index}, random_key
        );

        sender.pub.users[group_name][current_group_member_name].outbox.push(user_message);
    }
}

export async function download_team_messages(reciever, group_name) {
    const reciever_timestamp = reciever.priv.teams[group_name].timestamp;
    reciever_timestamp[reciever.pub.uid] += 1;

    const team_members = reciever.priv.teams[group_name].members;

    // loop for each team member
    for (let i = 0; i < team_members.length; i++) {
        const sender_pub = team_members[i];

        // loop for each message from a team member
        const new_messages = sender_pub.users[group_name][reciever.pub.uid].outbox;

        for (let j = 0; j < new_messages.length; j++) {
            const current_message = new_messages.shift();
            const parsed_message = await user_messaging.parse_user_message(
                reciever.priv.users[group_name][sender_pub.uid].conversation, current_message
            );

            const message_header = parsed_message.header;
            const encryption_key = parsed_message.message;

            const index_of_group_message = message_header.message_index;

            const group_message = sender_pub.teams[group_name].outbox[index_of_group_message];

            const decrypted_buffer = await crypto.decrypt(encryption_key, group_message);
            const typed_array = new Uint8Array(decrypted_buffer);
            const timestamp_size = new Uint32Array(typed_array.slice(0, 4).buffer)[0];

            const timestamp_buffer = typed_array.slice(4, (timestamp_size + 4)).buffer;

            const timestamp = await crypto.decode_object(timestamp_buffer);

            const message_buffer = typed_array.slice((timestamp_size + 4), typed_array.length);
            const message = await crypto.decode_string(message_buffer);


            // When trying to sort through the keys, take list of uid and the keys, and just go
            // through one by one, and take the max. between the two objects.

            for (let k = 0; k < team_members.length; k++) {
                const curr_member_uid = team_members[k].uid;

                if (timestamp[curr_member_uid] > reciever_timestamp[curr_member_uid]) {
                    reciever_timestamp[curr_member_uid] = timestamp[curr_member_uid];
                }

            }

            reciever.priv.teams[group_name].log.push(message);

        }
    }
}
