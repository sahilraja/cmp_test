import { newEnforcer } from 'casbin';
// const MongooseAdapter = require('@elastic.io/casbin-mongoose-adapter');

// import TypeORMAdapter from 'typeorm-adapter';

export async function casbin_policy() {
    try {
        // const model = __dirname + "\\..\\policy\\model.conf";
        // const adapter = await MongooseAdapter.newAdapter(process.env.MONGO_URL);
        // return await newEnforcer(model, adapter);

        // const a = await TypeORMAdapter.newAdapter({
        //     type: 'mongodb',
        //     database: 'rbac',
        // });
        // return await newEnforcer(__dirname + "\\..\\policy\\model.conf", a);

        return await newEnforcer('__dirname + "\\..\\policy\\model.conf', '__dirname + "\\..\\policy\\policy.csv');
    } catch (err) {
        console.log(err)
        throw err
    }

}