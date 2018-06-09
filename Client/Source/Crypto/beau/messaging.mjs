import  WebCrypto from "node-webcrypto-ossl";
const WC = new WebCrypto();
const CS = WC.subtle;

async function main() {
    let alice = user("alice");
    let bob = user("bob");

    let sent_message = await send_message("mensaje numero uno!");
    let recieved_message = await send_message("mensaje numero dos!");

    console.log("SENT MESSAGE");
    console.log(sent_message);
    console.log("RECIEVED MESSAGE");
    console.log(recieved_message);
}

async function user(name) {
    let u = {}
    u.name = name;
    return u;
}

async function send_message(message) {
    return message;
}

async function recieve_message(message) {
    return message;
}

main();
