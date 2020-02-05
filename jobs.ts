import { createQueue, app, Job } from "kue";
import { backgroundJobForDocumentPhases } from "./documents/module";
import { createJWT,userFindOne } from "./utils/users"
const queue = createQueue({
    redis:process.env.REDIS_URL || `redis://localhost:6379`
})
const PHASE_UPDATE = `UPDATE_PHASE`
export const jobRouter = app
export function createJob(delayTime: number){
    Job.rangeByType(PHASE_UPDATE, 'delayed', 0, 2, 'asc', async (err:any, jobs:any) => {
        console.log(`delayTime`, delayTime)
        if(err || !jobs.length){   
            queue.create(PHASE_UPDATE, {}).delay(new Date(delayTime)).priority('high').attempts(10).removeOnComplete(true).save()
            console.log(`No Jobs found. Hence created a job`)
        } else {
            console.log(`Existing Job Found while creation`)
        }
    })
}

queue.process(PHASE_UPDATE, async(job:any, done:any ) => {
    try {
        let user:any = await userFindOne("is_active", true, { firstName: 1, middleName: 1, lastName: 1, email: 1, phone: 1, is_active: 1 })
        let token= await createJWT({ id: user._id }); 
        backgroundJobForDocumentPhases(token)
    } catch (error) {
        job.log(error)        
    } finally {
        createJob(new Date().setHours(new Date().getHours() + 24, 0, 0, 0))
        done()
    }
})