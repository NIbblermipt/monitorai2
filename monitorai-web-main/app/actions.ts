"use server";

import { sendMail } from "./email";

type FormState = {
  success: boolean;
  message?: string;
  error?: any | null;
};

export async function handleContactFormSubmission(
  prevState: FormState,
  formData: FormData
) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const company = formData.get("company") as string;
  const screens = formData.get("screens") as string;

  const emailSubject = `Новая заявка с сайта MonitorAI от ${name}`;
  const emailText = `
Имя: ${name}
Email: ${email}
Компания: ${company}
Количество экранов: ${screens}
  `;

  try {
    await sendMail({
      to: process.env.EMAIL_TO ?? "bot@monitorai.ru",
      subject: emailSubject,
      text: emailText,
    });
    console.log("Contact form email sent successfully");
    return { success: true, message: "Ваша заявка успешно отправлена." };
  } catch (error: any) {
    console.error("Error sending contact form email:", error);
    return { success: false, error: error.message ?? "Не удалось отправить заявку." };
  }
}
