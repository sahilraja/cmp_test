import * as Enforcer from 'casbin';
import { default as TypeORMAdapter } from "typeorm-adapter";


export async function casbin_policy() {
    try {
        // const a = await TypeORMAdapter.newAdapter({
        //     type: 'mongodb',
        //     database: 'rbac'
        // });
        // return await Enforcer.newEnforcer(__dirname + '\\..\\policy\\model.conf', a);
        return await Enforcer.newEnforcer(__dirname + '\\..\\policy\\model.conf', __dirname + '\\..\\policy\\policy.csv')
    } catch (err) {
        console.log(err)
        throw err
    }

}