import * as Enforcer from 'casbin';

import { newEnforcer } from 'casbin';
const MongooseAdapter = require('@elastic.io/casbin-mongoose-adapter');

export async function casbin_policy() {
    try {
        const model = __dirname + "\\..\\policy\\model.conf";
        const adapter = await MongooseAdapter.newAdapter(process.env.MONGO_URL);
        return await await newEnforcer(model, adapter);
    } catch (err) {
        console.log(err)
        throw err
    }

}