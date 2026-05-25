import { useState } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Calendar, Building, MessageSquare, Send, CheckCircle } from 'lucide-react';
import { Card } from './Card';

const formSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  company: z.string().min(2, 'Company name must be at least 2 characters'),
  useCase: z.string().min(10, 'Please describe your use case (minimum 10 characters)'),
  timeline: z.enum(['immediate', '1-month', '3-months', '6-months', 'exploring']),
  message: z.string().optional(),
});

type FormSchema = z.infer<typeof formSchema>;

const inputClass = 'w-full px-4 py-3 rounded-xl border border-slate-200 bg-white/85 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-colors duration-150';

const DemoForm = () => {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormSchema>({ resolver: zodResolver(formSchema) });

  const onSubmit = async (data: FormSchema) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch('/api/demo-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const responseBody = await response.json().catch(() => null) as { message?: string; error?: string } | null;
        throw new Error(responseBody?.message || responseBody?.error || 'Failed to submit form');
      }
      setIsSubmitted(true);
      reset();
    } catch (error) {
      console.error('Error submitting form:', error);
      setSubmitError(error instanceof Error ? error.message : 'Failed to submit form');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <section id="demo" className="py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="text-center p-8">
            <CheckCircle className="h-14 w-14 text-cta mx-auto mb-4" />
            <h3 className="text-3xl font-semibold text-slate-950 mb-3">Demo request received</h3>
            <p className="text-slate-600">Our team will contact you within 24 hours with a tailored walkthrough.</p>
          </Card>
        </div>
      </section>
    );
  }

  return (
    <section id="demo" className="py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-slate-950 mb-4">Book a guided rollout</h2>
          <p className="text-lg md:text-xl text-slate-600">Get an implementation plan aligned with your security and compliance requirements.</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <Card className="p-6 md:p-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="demo-name" className="block text-sm font-medium text-slate-700 mb-2">Full Name *</label>
                  <input id="demo-name" {...register('name')} type="text" className={inputClass} placeholder="John Doe" />
                  {errors.name && <p className="mt-1 text-sm text-danger">{errors.name.message}</p>}
                </div>
                <div>
                  <label htmlFor="demo-email" className="block text-sm font-medium text-slate-700 mb-2">Work Email *</label>
                  <input id="demo-email" {...register('email')} type="email" className={inputClass} placeholder="john@company.com" />
                  {errors.email && <p className="mt-1 text-sm text-danger">{errors.email.message}</p>}
                </div>
              </div>

              <div>
                <label htmlFor="demo-company" className="block text-sm font-medium text-slate-700 mb-2">Company Name *</label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input id="demo-company" {...register('company')} type="text" className={`${inputClass} pl-10`} placeholder="Acme Corporation" />
                </div>
                {errors.company && <p className="mt-1 text-sm text-danger">{errors.company.message}</p>}
              </div>

              <div>
                <label htmlFor="demo-timeline" className="block text-sm font-medium text-slate-700 mb-2">Implementation Timeline *</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <select id="demo-timeline" {...register('timeline')} className={`${inputClass} pl-10 appearance-none cursor-pointer`}>
                    <option value="">Select timeline</option>
                    <option value="immediate">Immediate (within 1 month)</option>
                    <option value="1-month">1-3 months</option>
                    <option value="3-months">3-6 months</option>
                    <option value="6-months">6+ months</option>
                    <option value="exploring">Just exploring options</option>
                  </select>
                </div>
                {errors.timeline && <p className="mt-1 text-sm text-danger">{errors.timeline.message}</p>}
              </div>

              <div>
                <label htmlFor="demo-usecase" className="block text-sm font-medium text-slate-700 mb-2">Describe Your Use Case *</label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                  <textarea id="demo-usecase" {...register('useCase')} rows={4} className={`${inputClass} pl-10`} placeholder="Share your AI workflow, data classes, and governance goals." />
                </div>
                {errors.useCase && <p className="mt-1 text-sm text-danger">{errors.useCase.message}</p>}
              </div>

              <div>
                <label htmlFor="demo-message" className="block text-sm font-medium text-slate-700 mb-2">Additional Information</label>
                <textarea id="demo-message" {...register('message')} rows={3} className={inputClass} placeholder="Anything we should prepare before the call." />
              </div>

              <motion.button
                type="submit"
                disabled={isSubmitting}
                whileHover={{ scale: isSubmitting ? 1 : 1.01 }}
                whileTap={{ scale: isSubmitting ? 1 : 0.99 }}
                className="w-full button-primary cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  {isSubmitting ? 'Submitting...' : 'Schedule demo'}
                  {!isSubmitting && <Send className="h-4 w-4" />}
                </span>
              </motion.button>

              {submitError && (
                <p className="text-sm text-danger text-center" role="alert">
                  {submitError}
                </p>
              )}

              <p className="text-xs text-slate-500 text-center">By submitting, you agree to our privacy policy and terms.</p>
            </form>
          </Card>
        </motion.div>
      </div>
    </section>
  );
};

export default DemoForm;
