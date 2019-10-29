var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');

const EMAIL = process.env.EMAIL || "cmp@niua.org";
const PASSWORD = process.env.PASSWORD || "hahahaha"

// const EMAIL = process.env.EMAIL || 'jeevan.balla@transerve.com';
// const PASSWORD = process.env.PASSWORD || '7989238348';

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

    let transporter = nodemailer.createTransport(
      smtpTransport({
        host: 'smtp.rediffmailpro.com',
        port: '587',
        auth: {
          user: EMAIL,
          pass: PASSWORD
        }
      }));
    var mailOptions = {
      from: EMAIL,
      to: objBody.email,
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
