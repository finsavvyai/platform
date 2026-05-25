import React from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import Twitter from '@mui/icons-material/Twitter';
import LinkedIn from '@mui/icons-material/LinkedIn';
import Email from '@mui/icons-material/Email';

function encodeUri(s: string): string {
  return encodeURIComponent(s);
}

interface SocialShareButtonsProps {
  url: string;
  title: string;
}

export default function SocialShareButtons({ url, title }: SocialShareButtonsProps) {
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeUri(title)}&url=${encodeUri(url)}`;
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeUri(url)}`;
  const mailUrl = `mailto:?subject=${encodeUri(title)}&body=${encodeUri(`${title}\n\n${url}`)}`;

  return (
    <Box sx={{ display: 'flex', gap: 0.5 }}>
      <Tooltip title="Share on Twitter">
        <IconButton component="a" href={tweetUrl} target="_blank" rel="noopener noreferrer" size="small" aria-label="Share on Twitter">
          <Twitter />
        </IconButton>
      </Tooltip>
      <Tooltip title="Share on LinkedIn">
        <IconButton component="a" href={linkedInUrl} target="_blank" rel="noopener noreferrer" size="small" aria-label="Share on LinkedIn">
          <LinkedIn />
        </IconButton>
      </Tooltip>
      <Tooltip title="Share via email">
        <IconButton component="a" href={mailUrl} size="small" aria-label="Share via email">
          <Email />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
