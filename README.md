This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


 We are on the verge of greatness. Right now, my node @../src/depth_mapping/src/spatial_recognition_node.cpp outputs a bunch of different spatial            
  detections that are relative to the camera. I want you to integrate this with @../src/cloud_web_bridge/src/cloud_web_bridge_node.cpp . I want you to        
  take in these detects, and take the camera pose at that time frame, and using that, transforms these object detections onto the world frame. Then, I        
  want you to expose a route to the frontend similar to current routes that gives a list of these detections in the world frame. It should be in a            
  format: {                                                                                                                                                   
    "objects": [                                                                                                                                              
      { "id": "...", "name": "...", "position": {x,y,z}, "confidence": 0.94, "timestamp": "..." }                                                             
    ]                                                                                                                                                         
  } when requested from the websocket.