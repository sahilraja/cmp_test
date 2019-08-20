var AWS   = require('aws-sdk');


AWS.config.update({
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey:process.env.S3_ACCESS_SECRET,
});
var s3 = new AWS.S3();

export async function createFileInS3(fileName: any, arrData: any) {
    const params = {
        Bucket: process.env.S3_BUCKET,
        Key: fileName,
        Body: arrData,
        ACL:'public-read'
       };
    await s3.upload(params, function(err: any, data: any) {
        console.log(err, data);
        return data
    });
}