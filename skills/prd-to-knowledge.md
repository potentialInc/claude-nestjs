# PRD to PROJECT_KNOWLEDGE Converter

Convert a Product Requirements Document (PRD) PDF into structured `.claude-project/docs/PROJECT_KNOWLEDGE.md` documentation.

---

## Purpose

This resource guides the transformation of `prd.pdf` (located in the project root) into structured PROJECT_KNOWLEDGE.md documentation, providing Claude with product context for development tasks.

---

## When to Use

- Initial project setup from PRD
- After PRD updates to sync documentation
- When PROJECT_KNOWLEDGE.md needs regeneration
- When asked to "update project knowledge from PRD"

---

## Prerequisites

- `prd.pdf` must exist in the project root directory
- Write access to `.claude-project/docs/PROJECT_KNOWLEDGE.md`

---

## Execution Steps

### Step 1: Read the PRD

Use Claude's Read tool to read the PDF:

```
Read ./prd.pdf
```

### Step 2: Extract Information

From the PRD content, extract the following categories:

#### 1. Product Overview
- Application purpose (from document header/intro)
- Target users and their roles

#### 2. User Types
- PATIENT: Description and default sign-up behavior
- COACH: Description and assignment process

#### 3. Core Features by Role

**Common Features (Section 1)**
- Authentication (Login)
- Sign-up process
- Password reset flow

**Patient Features (Section 2)**
- Home Dashboard
- Exercise Module
- Daily Survey
- Chat functionality

**Coach Features (Section 3)**
- Home Dashboard
- My Patients management
- Chat functionality

#### 4. Key Data Entities
Infer from feature inputs/outputs:
- User fields
- Exercise fields
- ExerciseLog fields
- DailySurvey fields
- ZoomMeeting fields
- ChatRoom/ChatMessage fields

#### 5. Business Rules
Collect all "Rules" subsections from the PRD, including:
- Validation rules
- Status transition rules
- Automatic actions
- Conditional behaviors

### Step 3: Read Existing Architecture Section

Read the current PROJECT_KNOWLEDGE.md to preserve the Architecture Overview section:

```
Read .claude-project/docs/PROJECT_KNOWLEDGE.md
```

Extract and preserve:
- Architecture Overview
- Technology Stack
- Four-Layer Architecture diagram
- Base Classes Pattern
- Project Structure
- Integration Points
- Common Workflows

### Step 4: Generate PROJECT_KNOWLEDGE.md

Write the complete file to `.claude-project/docs/PROJECT_KNOWLEDGE.md` using the template below.

---

## Output Template

```markdown
# Project Knowledge

## Product Overview

### Application Purpose

{Summarize the application's purpose in 1-2 paragraphs. Include:
- What the app does
- Who it serves (Patients and Coaches)
- Core value proposition (exercise therapy management, health tracking, communication)}

### User Types

| Role        | Description                                      | Default Sign-up     |
| ----------- | ------------------------------------------------ | ------------------- |
| **PATIENT** | {description from PRD}                           | {sign-up rule}      |
| **COACH**   | {description from PRD}                           | {assignment rule}   |

### Core Features

#### Common (All Users)

- **Authentication**: {from PRD Login page - username + password, JWT tokens}
- **Sign-up**: {from PRD Sign Up page - required fields, verification}
- **Password Reset**: {from PRD Forgot password - verification method}

#### Patient Features

1. **Home Dashboard**
   {from PRD Section 2 - Home Tab}
   - Calendar with completion indicators
   - Today's exercise status
   - Today's survey status
   - Upcoming Zoom meeting

2. **Exercise Module**
   {from PRD Section 2 - Exercise Tab}
   - Exercise list with video links
   - Timer functionality
   - Intensity ratings
   - Exercise history

3. **Daily Survey**
   {from PRD Section 2 - Survey Tab}
   - Sleep tracking fields
   - Muscle pain level
   - Step count
   - Medication compliance
   - Survey history

4. **Chat**
   {from PRD Section 2 - Chat Tab}
   - Text & image messaging
   - System messages

#### Coach Features

1. **Home Dashboard**
   {from PRD Section 3 - Home Tab}
   - Today's Zoom meetings
   - Calendar view
   - Meeting management

2. **My Patients**
   {from PRD Section 3 - My patients Tab}
   - Patient list
   - Patient detail view
   - Exercise/survey history viewing

3. **Chat**
   {from PRD Section 3 - Chat Tab}
   - Multi-patient chat rooms
   - Search functionality

### Key Data Entities

| Entity      | Description                                                                          |
| ----------- | ------------------------------------------------------------------------------------ |
| User        | username, password, fullName, phoneNumber, email, role (PATIENT/COACH)               |
| Exercise    | title, description, videoUrl, sets, reps/duration                                    |
| ExerciseLog | userId, date, totalTime, exercises[], overallIntensityRating                         |
| DailySurvey | userId, date, bedtime, wakeUpTime, sleepQuality, musclePain, stepCount, etc.         |
| ZoomMeeting | coachId, patientId, dateTime, zoomLink, status (scheduled/completed/cancelled), memo |
| ChatRoom    | participants[]                                                                       |
| ChatMessage | senderId, content, imageUrl, type (user/system), timestamp                           |

### Business Rules

{Bullet list of all rules extracted from PRD "Rules" sections:}

- After successful sign-up, role = PATIENT
- User logs in with username + password
- UI greetings always use Full Name (not username)
- Patients can re-submit daily surveys (overwrites previous)
- Exercise time accumulates per day across sessions
- Zoom "Join" button enabled 10 minutes before meeting start
- Auto-reminder to coach if meeting still "scheduled" 1 hour after end time
- Changing/cancelling Zoom meeting sends system chat message
- {additional rules from PRD...}

---

## Architecture Overview

{PRESERVE THIS ENTIRE SECTION FROM EXISTING PROJECT_KNOWLEDGE.md}

### Technology Stack

- **Backend**: NestJS 11, TypeScript 5.7+, TypeORM 0.3.27
- **Database**: PostgreSQL 16
- **Authentication**: JWT Bearer tokens with Passport
- **Validation**: class-validator decorators
- **API Documentation**: Swagger/OpenAPI
- **Error Tracking**: Sentry v8 (optional)

### Four-Layer Architecture

{PRESERVE ASCII diagram from existing file}

### Base Classes Pattern

{PRESERVE from existing file}

## Project Structure

{PRESERVE from existing file}

## Integration Points

{PRESERVE from existing file}

## Common Workflows

{PRESERVE from existing file}

---

**Related Documentation**:

- [Backend Development Guidelines](../skills/best-practices.md)
- [Error Tracking Guide](../skills/error-tracking/SKILL.md)
- [Route Testing Guide](../skills/route-tester/SKILL.md)
- [Best Practices](BEST_PRACTICES.md)
- [Troubleshooting Guide](TROUBLESHOOTING.md)
```

---

## Transformation Rules

### PRD Section to Output Mapping

| PRD Section | PROJECT_KNOWLEDGE Section | Notes |
|-------------|---------------------------|-------|
| Header/Intro | Product Overview > Application Purpose | Summarize purpose |
| Section 1. Common | Core Features > Common | Login, Signup, Password |
| Section 2. Patient | Core Features > Patient Features | All patient tabs |
| Section 3. Coach | Core Features > Coach Features | All coach tabs |
| Navigation Menus | Core Features structure | Use for organization |
| "Rules" subsections | Business Rules | Collect all rules |
| Feature inputs/fields | Key Data Entities | Infer entity structures |

### Entity Inference from PRD Features

| PRD Feature | Entity Fields to Extract |
|-------------|--------------------------|
| Sign Up inputs | User: username, password, fullName, phoneNumber, email |
| Exercise List | Exercise: title, description, videoUrl, status |
| Exercise Timer | ExerciseLog: timeSpentSeconds, date |
| Intensity Rating | ExerciseLog: intensityRating (1-10), eachIntensityRating (3-level) |
| Survey questions | DailySurvey: all 7 fields from PRD |
| Zoom meeting details | ZoomMeeting: patient, date, time, zoomLink, memo, status |
| Chat features | ChatRoom, ChatMessage: senderId, content, imageUrl, type |

---

## Error Handling

### PDF Not Found

If `prd.pdf` does not exist in the project root:

```
Error: prd.pdf not found in project root.

Please either:
1. Place the PRD PDF at ./prd.pdf
2. Provide the correct path to your PRD file
```

### Incomplete PRD Content

If PRD sections are missing:
1. Generate what is available
2. Mark missing sections with: `<!-- TODO: Section not found in PRD -->`
3. Inform user of incomplete sections

### Architecture Section Not Found

If existing PROJECT_KNOWLEDGE.md doesn't exist or lacks Architecture section:
1. Use default Architecture template
2. Mark sections that need manual completion
3. Notify user to review and complete technical details

---

## Example Invocations

Users can trigger this with:
- "Update PROJECT_KNOWLEDGE.md from the PRD"
- "Convert prd.pdf to project knowledge"
- "Regenerate project knowledge from PRD"
- "Sync project documentation with PRD"

---

## Checklist

Before completing, verify:

- [ ] Product Overview section is complete
- [ ] All user types are documented
- [ ] Core features match PRD structure
- [ ] Key data entities are inferred correctly
- [ ] Business rules are comprehensive
- [ ] Architecture section is preserved from existing file
- [ ] Related documentation links are correct

---

## Related Resources

- [Architecture Overview](architecture-overview.md) - Technical architecture details
- [Database Patterns](database-patterns.md) - Entity design patterns
- [Generate API Docs](generate-api-docs.md) - Similar documentation generation pattern
