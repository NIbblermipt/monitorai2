"use client";

import { useActionState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import Form from "next/form";
import {
  AlertCircle,
  MonitorSmartphone,
  MessageSquare,
  Server,
  Mail,
  CheckCircle,
} from "lucide-react";

// Assuming these are from a UI library like shadcn/ui
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// Assuming handleContactFormSubmission is a server action imported from elsewhere
import { handleContactFormSubmission } from "@/app/actions"; // Adjust path as needed

export default function HomeClient(props: { directusUrl?: string }) {
  const [state, formAction] = useActionState(handleContactFormSubmission, {
    success: false,
    error: null,
    message: undefined,
  });

  useEffect(() => {
    if (state.success) {
      toast.success(state.message);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Image
              src="/logo.svg"
              alt="MonitorAI Logo"
              width={32}
              height={32}
              className="h-8 w-8"
            />
            <span className="text-xl font-bold">MonitorAI</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="mailto:bot@monitorai.ru"
              className="hidden md:inline-block text-muted-foreground"
            >
              bot@monitorai.ru
            </a>
            <a
              href={props.directusUrl ?? "https://monitorai.ru"}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground px-4 py-2"
            >
              Войти
            </a>
            <Button
              className="hidden sm:flex"
              onClick={() =>
                document
                  .getElementById("contact")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Подключиться
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-blue-400 py-16 md:py-24">
          <div className="absolute inset-0 bg-grid-white/[0.1] bg-[size:16px_16px]"></div>
          <div className="absolute right-0 top-0 -z-10 h-full w-full opacity-20">
            <Image
              src="/pattern.svg"
              alt="Background Pattern"
              width={400}
              height={400}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="container relative">
            <div className="grid gap-8 md:grid-cols-2 md:gap-12">
              <div className="flex flex-col justify-center space-y-4">
                <h1 className="text-3xl font-bold tracking-tighter text-white sm:text-4xl md:text-5xl">
                  Автоматический мониторинг видеоэкранов с ИИ-аналитикой
                </h1>
                <p className="text-xl text-white/90">
                  Обнаружение неисправностей за 5 минут, уведомления в режиме
                  реального времени
                </p>
                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <Button
                    size="lg"
                    className="bg-white text-blue-600 hover:bg-white/90"
                    onClick={() =>
                      document
                        .getElementById("contact")
                        ?.scrollIntoView({ behavior: "smooth" })
                    }
                  >
                    Подключиться
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-center">
                <div className="relative w-full max-w-md overflow-hidden rounded-lg border-4 border-white/20 shadow-xl">
                  <Image
                    src="/dashboard.png"
                    alt="Интерфейс системы мониторинга"
                    width={600}
                    height={400}
                    className="w-full"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-indigo-600/90 p-3 text-white">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5" />
                      <span className="font-medium">
                        Новый инцидент: Выключен сегмент
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-16 md:py-24">
          <div className="container">
            <h2 className="mb-12 text-center text-3xl font-bold tracking-tight">
              Особенности системы
            </h2>
            <div className="grid gap-8 md:grid-cols-2 lg:gap-12">
              <Card>
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row items-start gap-4">
                    <div className="rounded-full bg-blue-100 p-3">
                      <MonitorSmartphone className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">
                        Автоматическая диагностика
                      </h3>
                      <p className="mt-2 text-muted-foreground">
                        Анализ изображений на дефекты:
                      </p>
                      <ul className="mt-2 space-y-1">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                          <span>Выключен сегмент</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                          <span>Выключен сегмент RGB</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                          <span>Выключен весь экран</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row items-start gap-4">
                    <div className="rounded-full bg-blue-100 p-3">
                      <MessageSquare className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">Уведомления</h3>
                      <p className="mt-2 text-muted-foreground">
                        Мгновенные оповещения о проблемах через:
                      </p>
                      <ul className="mt-2 space-y-1">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                          <span>Telegram</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                          <span>Email</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row items-start gap-4">
                    <div className="rounded-full bg-blue-100 p-3">
                      <Server className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">Масштабирование</h3>
                      <p className="mt-2 text-muted-foreground">
                        Гибкая система, растущая вместе с вашим бизнесом:
                      </p>
                      <ul className="mt-2 space-y-1">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                          <span>Поддержка до 100 000 экранов</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                          <span>Облачное хранение данных</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                          <span>Высокая отказоустойчивость</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row items-start gap-4">
                    <div className="rounded-full bg-blue-100 p-3">
                      <MonitorSmartphone className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">
                        Поддерживаемые ОС
                      </h3>
                      <p className="mt-2 text-muted-foreground">
                        Работает на всех популярных платформах:
                      </p>
                      <ul className="mt-2 space-y-1">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                          <span>Windows</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                          <span>Linux</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span>Android</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Contact Form */}
        <section id="contact" className="bg-blue-50 py-16 md:py-24">
          <div className="container">
            <div className="mx-auto max-w-md space-y-6">
              <div className="space-y-2 text-center">
                <h2 className="text-3xl font-bold tracking-tight">
                  Подключить экраны
                </h2>
                <p className="text-muted-foreground">
                  Заполните форму, и мы свяжемся с вами в течение рабочего дня
                </p>
              </div>
              <Form className="space-y-4" action={formAction}>
                <div className="grid gap-2">
                  <Label htmlFor="name">Имя</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Введите ваше имя"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="example@company.com"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="company">Компания</Label>
                  <Input
                    id="company"
                    name="company"
                    placeholder="Название вашей компании"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="screens">Количество экранов</Label>
                  <Select name="screens" required>
                    {/* Add name attribute here */}
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите количество" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10-100">10-100</SelectItem>
                      <SelectItem value="100-1000">100-1000</SelectItem>
                      <SelectItem value="1000+">1000+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full">
                  Отправить заявку
                </Button>
                <p className="px-2 text-center text-sm text-muted-foreground">
                  Нажимая на кнопку "Отправить заявку", вы соглашаетесь с{" "}
                  <Link
                    href="/privacy"
                    className="underline underline-offset-4 hover:text-primary"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    политикой обработки персональных данных
                  </Link>
                  .
                </p>
              </Form>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-16 md:py-24">
          <div className="container">
            <h2 className="mb-12 text-center text-3xl font-bold tracking-tight">
              Часто задаваемые вопросы
            </h2>
            <div className="mx-auto max-w-3xl">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1">
                  <AccordionTrigger className="text-start">
                    Сколько экранов можно подключить?
                  </AccordionTrigger>
                  <AccordionContent>
                    Система MonitorAI поддерживает мониторинг до 100 000 экранов
                    одновременно, что делает её идеальным решением как для
                    небольших сетей, так и для крупных медиахолдингов.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2">
                  <AccordionTrigger className="text-start">
                    Какие ОС поддерживаются?
                  </AccordionTrigger>
                  <AccordionContent>
                    MonitorAI работает на всех популярных операционных системах:
                    Windows, Linux и Android. Это обеспечивает гибкость при
                    интеграции с существующей инфраструктурой.\n
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-3">
                  <AccordionTrigger className="text-start">
                    Какие дефекты обнаруживает система?
                  </AccordionTrigger>
                  <AccordionContent>
                    Система обнаруживает следующие типы дефектов:
                    <ul className="mt-2 list-disc pl-6">
                      <li>Муарный узор (полосы на экране)</li>
                      <li>Полная неработоспособность плашки</li>
                      <li>Частичная потеря цветов (CMYK)</li>
                    </ul>
                    Алгоритмы ИИ постоянно совершенствуются для обнаружения
                    новых типов дефектов.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-gray-50 py-8">
        <div className="container">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <Image
                src="/logo.svg"
                alt="MonitorAI Logo"
                width={24}
                height={24}
                className="h-6 w-6"
              />
              <span className="text-sm font-semibold">MonitorAI</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                <a href="mailto:bot@monitorai.ru">bot@monitorai.ru</a>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              © MonitorAI, 2025
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
