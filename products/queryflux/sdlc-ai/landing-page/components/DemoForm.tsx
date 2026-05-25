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

const DemoForm = () => {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit = async (data: FormSchema) => {
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/demo-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        setIsSubmitted(true);
        reset();
      } else {
        throw new Error('Failed to submit form');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-2xl mx-auto"
      >
        <Card className="text-center p-8 border border-green-400/30">
          <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-white mb-2">
            Threat Review Request Received
          </h3>
          <p className="text-slate-300 mb-6">
            Thanks for reaching out to OpenSyber. A solutions architect will contact you
            within 24 hours to schedule your working session.
          </p>
          <div className="text-sm text-slate-400">
            <p>What happens next:</p>
            <ul className="mt-2 space-y-1">
              <li>• Security and compliance discovery call</li>
              <li>• Mapping of your AI data paths and high-risk prompts</li>
              <li>• Live policy simulation in your target environment</li>
              <li>• Launch plan with pilot milestones and ownership</li>
            </ul>
          </div>
        </Card>
      </motion.div>
    );
  }

  return (
    <section id="demo" className="py-20 bg-[#050910]/70">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Book Your OpenSyber Threat Review
          </h2>
          <p className="text-xl text-slate-300">
            Bring your real use case. We will map controls, policy gaps, and rollout steps live.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Card className="p-8 border border-sky-500/20">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-2">
                    Full Name *
                  </label>
                  <input
                    {...register('name')}
                    type="text"
                    required
                    className="w-full px-4 py-3 bg-slate-900/60 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sdlc-accent focus:border-transparent"
                    placeholder="John Doe"
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-400">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                    Work Email *
                  </label>
                  <input
                    {...register('email')}
                    type="email"
                    required
                    className="w-full px-4 py-3 bg-slate-900/60 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sdlc-accent focus:border-transparent"
                    placeholder="john@company.com"
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-400">{errors.email.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="company" className="block text-sm font-medium text-slate-300 mb-2">
                  Company Name *
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-500" />
                  <input
                    {...register('company')}
                    type="text"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-slate-900/60 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sdlc-accent focus:border-transparent"
                    placeholder="Acme Corporation"
                  />
                </div>
                {errors.company && (
                  <p className="mt-1 text-sm text-red-400">{errors.company.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="timeline" className="block text-sm font-medium text-slate-300 mb-2">
                  Implementation Timeline *
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-500" />
                  <select
                    {...register('timeline')}
                    required
                    className="w-full pl-10 pr-4 py-3 bg-slate-900/60 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-sdlc-accent focus:border-transparent appearance-none"
                  >
                    <option value="">Select timeline</option>
                    <option value="immediate">Immediate (within 1 month)</option>
                    <option value="1-month">1-3 months</option>
                    <option value="3-months">3-6 months</option>
                    <option value="6-months">6+ months</option>
                    <option value="exploring">Just exploring options</option>
                  </select>
                </div>
                {errors.timeline && (
                  <p className="mt-1 text-sm text-red-400">{errors.timeline.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="useCase" className="block text-sm font-medium text-slate-300 mb-2">
                  Describe Your Use Case *
                </label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-3 h-5 w-5 text-slate-500" />
                  <textarea
                    {...register('useCase')}
                    rows={4}
                    required
                    className="w-full pl-10 pr-4 py-3 bg-slate-900/60 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sdlc-accent focus:border-transparent resize-none"
                    placeholder="Tell us about your AI workflows, data sensitivity, and compliance targets."
                  />
                </div>
                {errors.useCase && (
                  <p className="mt-1 text-sm text-red-400">{errors.useCase.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-slate-300 mb-2">
                  Additional Information (Optional)
                </label>
                <textarea
                  {...register('message')}
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-900/60 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sdlc-accent focus:border-transparent resize-none"
                  placeholder="Anything else the team should prepare before the session."
                />
              </div>

              <motion.button
                type="submit"
                disabled={isSubmitting}
                whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
                whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
                className="w-full button-primary flex items-center justify-center"
              >
                {isSubmitting ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                    Submitting...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <Send className="h-5 w-5 mr-2" />
                    Book Threat Review
                  </div>
                )}
              </motion.button>

              <p className="text-xs text-slate-500 text-center">
                By submitting this form, you agree to our privacy policy and terms of service.
                We use your details only to scope your secure pilot and onboarding.
              </p>
            </form>
          </Card>
        </motion.div>
      </div>
    </section>
  );
};

export default DemoForm;
