import * as mongoose  from 'mongoose';
import * as tunnel from 'tunnel-ssh';
import { homedir } from 'os';
import * as path from 'path';
import { readFileSync, constants } from "fs";
import { USE_REMOTE_DB } from './urls';
import { userInit, init, siteConstants, notifications, templates } from './role_management';


async function initializeDB() {
    try {
        await userInit();
        await siteConstants();
        await notifications();
        await templates();
        // await init();
    } catch (err) {
        console.error(err);
    }
}

function handleMongooseConnection(successMessage : string) {
    const db = mongoose.connection;
    db.on('error', function (err : Error) {
        console.error(err);
    });
    db.once('open', function() {
        // we're connected!
        console.log(successMessage);
        initializeDB();
    });
}
if (!USE_REMOTE_DB) {
    mongoose.connect(process.env.MONGO_URL as any, { useNewUrlParser: true });
    handleMongooseConnection("Local DB connected ");
} else {
    const sshTunnelConfig = {
        agent: process.env.SSH_AUTH_SOCK,
        username: 'ubuntu',
        privateKey: readFileSync(path.join(homedir(), '.ssh/citiis2.pem')),
        host:'13.235.227.24',
        port: 22,
        dstHost: 'localhost',
        dstPort: 27017, //or 27017 or something like that
        // localHost: '127.0.0.1',
        // localPort: 50001 //or anything else unused you want
    };

    tunnel(sshTunnelConfig, function (error : Error, server : any) {
        if(error){
            console.log("SSH connection error: " + error);
        }
        mongoose.connect('mongodb://localhost:27017/cmp-dev?authSource=admin', { auth : {
            user: 'cmp-dev',
            password: 'Hello6362373783'
        } });

        handleMongooseConnection("Remote DB connection successful");
    });
}