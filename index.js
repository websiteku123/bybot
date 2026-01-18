const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion, 
    makeInMemoryStore, 
    jidDecode, 
    proto 
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const { Boom } = require("@hapi/boom");
const readline = require("readline");

const phoneNumber = "6283119396819";
const usePairingCode = true;
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });

async function Starts() {
    const { state, saveCreds } = await useMultiFileAuthState("./session");
    const { version } = await fetchLatestBaileysVersion();

    const Cantarella = makeWASocket({
        printQRInTerminal: !usePairingCode,
        syncFullHistory: true,
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000,
        generateHighQualityLinkPreview: true, 
        version,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        logger: pino({ level: 'silent' }),
        auth: state
    });

    // Logika Pairing Code
    if (usePairingCode && !Cantarella.authState.creds.registered) {
        setTimeout(async () => {
            let code = await Cantarella.requestPairingCode(phoneNumber);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(`
╭────────────────╼
╎ Your Pairing Code : ${code}
╰────────────────╼`);
        }, 3000);
    }

    Cantarella.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
            if (reason === DisconnectReason.loggedOut) { 
                console.log("Device Logged Out, Please Delete Session and Scan Again."); 
                process.exit();
            } else {
                Starts();
            }
        } else if (connection === "open") {
            console.log("Bot Berhasil Terhubung!");
        }
    });

    Cantarella.ev.on("creds.update", saveCreds);

    // Handler Pesan
    Cantarella.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const m = chatUpdate.messages[0];
            if (!m.message) return;
            const contents = JSON.stringify(m.message);
            const type = Object.keys(m.message)[0];
            const body = (type === 'conversation') ? m.message.conversation : (type === 'extendedTextMessage') ? m.message.extendedTextMessage.text : (type === 'imageMessage') ? m.message.imageMessage.caption : (type === 'videoMessage') ? m.message.videoMessage.caption : '';
            const prefix = /^[°•π÷×¶∆£¢€¥®™✓_=|~!?@#$%^&.\/\\©^]/.test(body) ? body.match(/^[°•π÷×¶∆£¢€¥®™✓_=|~!?@#$%^&.\/\\©^]/)[0] : '';
            const isCmd = body.startsWith(prefix);
            const command = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : '';
            const args = body.trim().split(/ +/).slice(1);
            const text = args.join(" ");
            const reply = (teks) => Cantarella.sendMessage(m.key.remoteJid, { text: teks }, { quoted: m });

            switch (command) {
                case 'iqc': {
                    if (!text) return reply('Mana Text Nya?');
                    if (text.length > 80) return reply('Max 80 Text');
                    reply("Proses...");
                    await Cantarella.sendMessage(m.key.remoteJid, {
                        image: { url: 'https://flowfalcon.dpdns.org/imagecreator/iqc?text=' + encodeURIComponent(text) },
                        caption: `Sukses membuat IQC untuk: ${text}`
                    }, { quoted: m });
                }
                break;

                default:
                    // Tambahkan command lain di sini
            }
        } catch (err) {
            console.log(err);
        }
    });

    return Cantarella;
}

Starts();
