import { constantSchema } from "../site-constants/model";

var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');

// const EMAIL = process.env.EMAIL || "cmp@niua.org";
// const PASSWORD = process.env.PASSWORD || "hahahaha"

const EMAIL = process.env.EMAIL || 'saikumar.b@transerve.com';
const PASSWORD = process.env.PASSWORD || 'sai@transerve.001';

// let transport = process.env.EMAIL ? smtpTransport({
//   host: 'smtp.rediffmailpro.com',
//   port: '587',
//   auth: {
//     user: EMAIL,
//     pass: PASSWORD
//   }
// }) : {
//     service: 'gmail',
//     auth: {
//       user: EMAIL,
//       pass: PASSWORD
//     }
//   }

export async function nodemail(objBody: any) {
  try {
    let constants: any = await constantSchema.findOne({ key: 'bcc' }).exec();
    let transporter = nodemailer.createTransport(
      smtpTransport({
        service: 'gmail',
        auth: {
          user: EMAIL,
          pass: PASSWORD
        }
      })
    );
    var mailOptions = {
      from: EMAIL,
      to: objBody.email,
      bcc: constants.value || "",
      subject: objBody.subject,
      html: objBody.html
    };

    transporter.sendMail(mailOptions, function (error: any, info: any) {
      if (error) {
        console.error(error);
      } else {
        console.log('Email sent: ' + info.response);
      }
    });

  } catch (err) {
    console.error(err)
    throw err;
  }
}
