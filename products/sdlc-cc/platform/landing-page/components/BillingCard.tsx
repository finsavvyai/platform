import Link from "next/link";
import { motion } from "framer-motion";
import { CreditCard, ExternalLink } from "lucide-react";

type BillingCardProps = {
  plan?: string;
  status?: string;
};

export default function BillingCard({
  plan = "Free",
  status = "active",
}: BillingCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mt-6 bg-gray-900 rounded-lg border border-gray-800 p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-gray-400" />
          <h3 className="text-xl font-bold text-white">Billing</h3>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <span className="text-sm text-gray-400">Plan</span>
          <p className="text-white font-medium">{plan}</p>
        </div>
        <div>
          <span className="text-sm text-gray-400">Status</span>
          <p className="text-white font-medium capitalize">{status}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href="/checkout/startup"
          className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Upgrade plan
          <ExternalLink className="ml-2 h-4 w-4" />
        </Link>
        <Link
          href="/#pricing"
          className="inline-flex items-center rounded-lg border border-gray-600 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 transition-colors"
        >
          View pricing
        </Link>
      </div>
    </motion.div>
  );
}
