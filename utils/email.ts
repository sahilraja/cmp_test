import { constantSchema } from "../site-constants/model";

var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');
let EMAIL: string
let PASSWORD: string
if (process.env.EMAIL_ENV == "UAT" || process.env.EMAIL_ENV == "PROD") {
  EMAIL = process.env.EMAIL || "cmp@niua.org";
  PASSWORD = process.env.PASSWORD || "hahahaha"
} else {
  // EMAIL = process.env.EMAIL || `testmailm588@gmail.com`;
  // PASSWORD = process.env.PASSWORD || 'Hello@123';

  EMAIL = process.env.EMAIL || `tccmp1234@gmail.com`;
  PASSWORD = process.env.PASSWORD || 'Hello@123';
}

let transport = (process.env.EMAIL_ENV == "UAT" || process.env.EMAIL_ENV == "PROD") ? smtpTransport({
  host: 'smtp.rediffmailpro.com',
  port: '465',
  secure: true,
  auth: {
    user: EMAIL,
    pass: PASSWORD
  }
}) : {
    host: 'smtp.gmail.com',
    port: '587',
    auth: {
      user: EMAIL,
      pass: PASSWORD
    }
  }

export async function nodemail(objBody: any) {
  try {
    let constants: any = await constantSchema.findOne({ key: 'bcc' }).exec();
    let transporter = nodemailer.createTransport(
      transport
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
        console.log('Email sent to : ' + mailOptions.to + ` ` + info.response);
      }
    });
    transporter.close()
  } catch (err) {
    console.error(err)
    throw err;
  }
}
