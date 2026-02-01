# Spatial Map Guidance Integration Guide

## Overview

The SpatialMap component now supports guided navigation with a red arrow and path line from the user's position to any detected object. This guide explains how to integrate voice and text-based guidance requests.

## Features

✅ **Visual Guidance**: Red arrow and curved path line from user to target object
✅ **Voice Feedback**: Automatic voice announcement with distance information
✅ **UI Controls**: "Guide Me" button appears when an object is selected
✅ **Query Support**: Find objects by name using fuzzy matching
✅ **Animations**: Smooth pulsing line and bobbing arrow for better visibility

## Basic Usage

### 1. Click-based Guidance (Already Implemented)

When a user clicks on a colored node:
1. The object gets selected and highlighted
2. A panel appears with "Deselect" and "Guide Me" buttons
3. Clicking "Guide Me" activates the red path and voice guidance

### 2. Voice/Text Query Guidance

Use the `guidanceQuery` prop to trigger guidance programmatically:

```tsx
import { SpatialMap } from './components/SpatialMap';

function MyComponent() {
  const [guidanceQuery, setGuidanceQuery] = useState<string | null>(null);

  // Example: User says "guide me to my keys"
  const handleVoiceCommand = (command: string) => {
    // Extract the object name from the command
    const match = command.match(/guide me to (?:my |the )?(.+)/i);
    if (match) {
      const objectName = match[1]; // e.g., "keys"
      setGuidanceQuery(objectName);

      // Reset after short delay to allow re-triggering
      setTimeout(() => setGuidanceQuery(null), 100);
    }
  };

  return (
    <SpatialMap
      data={spatialData}
      selectedObjectId={selectedObjectId}
      onObjectSelect={setSelectedObjectId}
      onGuideRequest={(objectId) => console.log('Guiding to:', objectId)}
      guidanceQuery={guidanceQuery}
    />
  );
}
```

### 3. Fuzzy Object Matching

The `findObjectByQuery` utility function supports:
- **Exact match**: "water bottle" → "water bottle"
- **Partial match**: "bottle" → "water bottle"
- **Word match**: "water" → "water bottle"

Example queries that would work:
- "guide me to my keys" → finds "keys"
- "where is the backpack" → finds "backpack"
- "find my water" → finds "water bottle"

## Integration Examples

### Voice Input (Web Speech API)

```tsx
import { useEffect } from 'react';

function VoiceGuidedMap() {
  const [guidanceQuery, setGuidanceQuery] = useState<string | null>(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.continuous = true;
      recognition.interimResults = false;

      recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase();

        // Check for guidance commands
        if (transcript.includes('guide me to') || transcript.includes('find')) {
          const objectMatch = transcript.match(/(?:guide me to|find) (?:my |the )?(.+)/);
          if (objectMatch) {
            setGuidanceQuery(objectMatch[1]);
            setTimeout(() => setGuidanceQuery(null), 100);
          }
        }
      };

      recognition.start();

      return () => recognition.stop();
    }
  }, []);

  return (
    <SpatialMap
      guidanceQuery={guidanceQuery}
      // ... other props
    />
  );
}
```

### Text/Chat Input

```tsx
function ChatGuidedMap() {
  const [chatInput, setChatInput] = useState('');
  const [guidanceQuery, setGuidanceQuery] = useState<string | null>(null);

  const handleChatSubmit = (message: string) => {
    const lowerMessage = message.toLowerCase();

    // Parse guidance commands
    if (lowerMessage.includes('guide') || lowerMessage.includes('find') || lowerMessage.includes('where')) {
      // Extract object name
      const patterns = [
        /guide (?:me )?to (?:my |the )?(.+)/,
        /find (?:my |the )?(.+)/,
        /where is (?:my |the )?(.+)/,
      ];

      for (const pattern of patterns) {
        const match = lowerMessage.match(pattern);
        if (match) {
          setGuidanceQuery(match[1]);
          setTimeout(() => setGuidanceQuery(null), 100);
          break;
        }
      }
    }
  };

  return (
    <>
      <input
        value={chatInput}
        onChange={(e) => setChatInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleChatSubmit(chatInput);
            setChatInput('');
          }
        }}
      />
      <SpatialMap
        guidanceQuery={guidanceQuery}
        // ... other props
      />
    </>
  );
}
```

## Props Reference

### SpatialMapProps

```typescript
interface SpatialMapProps {
  data?: SpatialData;                    // Spatial data with objects and camera position
  selectedObjectId?: string | null;       // Currently selected object ID
  onObjectSelect?: (id: string | null) => void;  // Callback when object is selected/deselected
  onGuideRequest?: (objectId: string) => void;   // Callback when guidance is activated
  guidanceQuery?: string | null;          // External query to trigger guidance (object name)
  className?: string;
}
```

## Visual Design

The guidance path is designed to be visible but not obstructive:

- **Red curved path**: Subtle arc from user to target
- **Pulsing opacity**: Line pulses between 70-90% opacity
- **Bobbing arrow**: Red arrow gently bobs at destination
- **Glowing ring**: Semi-transparent ring at arrow base
- **Distance marker**: Shows distance in meters at midpoint

## Voice Guidance

When guidance is activated, the system speaks:
> "Guiding you to [object name]. It is approximately [distance] meters away. Follow the red path."

Voice guidance automatically stops when:
- User deselects the object
- User selects a different object
- Component unmounts

## Stop Guidance

To programmatically stop guidance:

```tsx
// Method 1: Deselect object
onObjectSelect(null);

// Method 2: Set guidanceQuery to null (if using query-based approach)
setGuidanceQuery(null);
```

## Troubleshooting

### Voice not working
- Check browser compatibility (Chrome/Edge recommended)
- Ensure `speechSynthesis` API is available
- Check browser permissions for speech

### Object not found by query
- Check object names in `data.objects`
- Try partial matching (e.g., "water" instead of "water bottle")
- Use `findObjectByQuery()` utility to test matching

### Path not appearing
- Ensure object is selected (`selectedObjectId` is set)
- Check that guidance is activated (`onGuideRequest` callback)
- Verify object exists in `data.objects`
