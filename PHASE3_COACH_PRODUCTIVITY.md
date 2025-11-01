# Phase 3: Coach Productivity AI Tools

## 🎯 Overview
Building AI-powered tools to help coaches create higher-quality content faster and gain insights into student progress.

---

## ✅ Phase 3.1: Content Quality Analyzer (COMPLETE)

### **What It Does:**
Analyzes lesson content and provides actionable improvement suggestions across 5 dimensions:
1. **Readability** - Language clarity, sentence structure, jargon explanation
2. **Completeness** - Coverage of objectives, examples, intro/conclusion
3. **Engagement** - Interest level, interactivity, format variety
4. **Structure** - Organization, headings, flow of ideas
5. **Accessibility** - Diverse learner support, alternative explanations, formatting

### **Features Implemented:**

**Backend AI Action:** `content_analyze`
- **Location:** `supabase/functions/ai-router/index.ts` (lines 1070-1213)
- **Input:** Content ID
- **Context:** Fetches lesson objectives, description, duration, content text
- **Output:** Structured JSON with:
  - 5 individual scores (1-10) + overall score
  - 3-5 prioritized improvement suggestions
  - List of missing elements
  - List of strengths to maintain

**Frontend Component:** `ContentQualityPanel`
- **Location:** `src/components/coach/ContentQualityPanel.tsx`
- **Features:**
  - Beautiful gradient score display
  - Progress bars for each dimension
  - Color-coded scores (green/yellow/red)
  - Prioritized improvements (high/medium/low)
  - Strengths highlighted in green
  - Missing elements flagged in orange
  - Re-analyze button

**UI Elements:**
- Overall quality score (large, centered)
- 5 detailed score breakdowns with icons
- Strengths section (green cards)
- Improvements section (priority badges)
- Missing elements section (orange alerts)

### **Integration Points:**
- Can be added to `CreateContentDialog` as a side panel
- Can be added to content editor pages
- Works with text and quiz content types

### **Example Output:**
```json
{
  "scores": {
    "readability": 8.5,
    "completeness": 7.0,
    "engagement": 6.5,
    "structure": 8.0,
    "accessibility": 7.5,
    "overall": 7.5
  },
  "improvements": [
    {
      "category": "Engagement",
      "suggestion": "Add interactive examples or practice questions",
      "priority": "high"
    }
  ],
  "missing_elements": [
    "Real-world examples",
    "Summary section"
  ],
  "strengths": [
    "Clear and concise language",
    "Well-structured content"
  ]
}
```

---

## ⏳ Phase 3.2: Practice Exercise Generator (PLANNED)

### **Goal:**
Auto-generate practice exercises, flashcards, and study materials from lesson content.

### **Features to Build:**

1. **Exercise Generator AI Action** (`practice_exercise_generate`)
   - Inputs: lesson_id or content_id, optional difficulty, skill_focus, quantity
   - Output: structured JSON payload containing a set and 5-10 exercises with answer/explanation metadata
   - Supported types: `multiple_choice`, `short_answer`, `fill_in_blank`, `scenario`
   - Uses existing lesson + module context, learner level, and previous quiz performance when available

2. **Flashcard Generator** (follow-up action)
   - Extract key concepts as Q/A flashcard pairs
   - Leverage same context fetcher; store as `practice_exercise_items` with `exercise_type = 'flashcard'`
   - Provide export as CSV/JSON for Anki/Quizlet

3. **Study Guide Builder** (optional enhancement)
   - Compose study guide sections (overview, key terms, sample questions)
   - Generate downloadable markdown/PDF and store raw output for later rendering

### **Architecture Blueprint**

| Layer | Responsibilities | Notes |
|-------|------------------|-------|
| **Database** | Persist exercise sets/items, metadata, approvals | New tables `practice_exercise_sets`, `practice_exercise_items`, reusable view for approved items |
| **AI Action** | Assemble prompt, call multi-provider pipeline, validate JSON | New action `practice_exercise_generate` in `ai-router` using json_schema for safety |
| **Frontend (Coach)** | UI to request exercises, review/edit, approve to publish | Side panel in lesson editor + modal preview, React Query mutation tied to AI action |
| **Frontend (Student)** | Optional display of approved exercises | Use existing lesson UI to show approved practice items |

### **Database Design**

```sql
-- Table: practice_exercise_sets
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
content_id UUID REFERENCES lesson_content(id) ON DELETE SET NULL,
generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
difficulty TEXT CHECK (difficulty IN ('intro', 'intermediate', 'advanced')),
skill_focus TEXT,
model_used TEXT,
prompt_context JSONB,
raw_output JSONB,
created_at TIMESTAMPTZ DEFAULT now(),
approved_at TIMESTAMPTZ,
status TEXT DEFAULT 'draft' CHECK (status IN ('draft','approved','rejected'));

-- Table: practice_exercise_items
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
set_id UUID REFERENCES practice_exercise_sets(id) ON DELETE CASCADE,
exercise_type TEXT CHECK (exercise_type IN ('multiple_choice','short_answer','fill_in_blank','scenario','flashcard')),
question TEXT NOT NULL,
answer TEXT,
explanation TEXT,
choices JSONB,        -- for MCQ
difficulty TEXT,
tags TEXT[],
order_index INT DEFAULT 0,
created_at TIMESTAMPTZ DEFAULT now(),
approved BOOLEAN DEFAULT false;

CREATE INDEX idx_practice_exercise_sets_lesson ON practice_exercise_sets(lesson_id);
CREATE INDEX idx_practice_exercise_items_set ON practice_exercise_items(set_id);
```

**RLS Strategy**
- Coaches & admins: full access to their organisation’s lessons.
- Students: `SELECT` only on approved items where lesson belongs to a course they’re enrolled in.
- AI-generated rows default to `status = 'draft'` & `approved = false`.

### **Prompt Strategy**

1. Fetch lesson/module/course context (title, objectives, summary).
2. Pull recent quiz/assessment results (if any) to tailor difficulty.
3. Include learner level + selected difficulty & skill focus.
4. AI response schema:

```json
{
  "set": {
    "difficulty": "intermediate",
    "skill_focus": "critical-thinking"
  },
  "exercises": [
    {
      "exercise_type": "multiple_choice",
      "question": "...",
      "choices": ["A","B","C","D"],
      "answer": "B",
      "explanation": "...",
      "tags": ["concept-x"],
      "difficulty": "medium"
    }
  ]
}
```

### **UI Flow**
1. Coach clicks “Generate Practice” in lesson editor sidebar.
2. Form allows selecting difficulty, skill focus, quantity.
3. Invoke `practice_exercise_generate`; display AI output in review modal.
4. Coach can edit items inline, approve/publish selected ones, or regenerate.
5. Approved items saved via Supabase insert mutation; optional export to CSV.

### **Next Steps**
1. Create migration for tables + RLS policies.
2. Implement AI action (prompt assembly, json schema, metadata logging).
3. Build React component(s) for generation + review.
4. Add student-facing component to surface approved exercises (Phase 3.4?).

### **Database Schema:**
```sql
CREATE TABLE practice_exercises (
  id UUID PRIMARY KEY,
  lesson_id UUID REFERENCES lessons(id),
  exercise_type TEXT, -- 'multiple_choice', 'short_answer', 'flashcard'
  question TEXT,
  answer TEXT,
  explanation TEXT,
  difficulty TEXT, -- 'easy', 'medium', 'hard'
  created_by_ai BOOLEAN DEFAULT true,
  approved_by_coach BOOLEAN DEFAULT false
);
```

---

## ⏳ Phase 3.3: Progress Insight Assistant (PLANNED)

### **Goal:**
Help coaches understand student progress and identify at-risk learners.

### **Features to Build:**

1. **Student Progress Summarizer**
   - Analyze `lesson_progress` and `content_interactions`
   - Generate narrative summaries per student
   - Identify struggling topics

2. **At-Risk Student Detector**
   - Flag students with low engagement
   - Detect patterns of incomplete lessons
   - Suggest intervention strategies

3. **Class Performance Dashboard**
   - Aggregate analytics across all students
   - Identify commonly difficult lessons
   - Suggest content improvements

### **AI Actions:**
- `student_progress_summary` - Narrative summary of individual student
- `class_analytics_summary` - Overview of class performance
- `intervention_suggest` - Suggest actions for at-risk students

---

## 📊 Implementation Status

| Feature | Backend | Frontend | Integration | Status |
|---------|---------|----------|-------------|--------|
| Content Quality Analyzer | ✅ Done | ✅ Done | ⏳ Pending | 90% |
| Practice Exercise Generator | ⏳ Planned | ⏳ Planned | ⏳ Planned | 0% |
| Progress Insight Assistant | ⏳ Planned | ⏳ Planned | ⏳ Planned | 0% |

---

## 🚀 Deployment Steps

### **Current (Phase 3.1):**
```bash
# Deploy updated ai-router with content_analyze action
supabase functions deploy ai-router
```

### **Testing Checklist:**
- [ ] Open content editor
- [ ] Add ContentQualityPanel component
- [ ] Click "Analyze Content"
- [ ] Verify scores display correctly
- [ ] Check improvements are actionable
- [ ] Test re-analyze functionality

---

## 💡 Key Benefits

### **For Coaches:**
1. **Time Savings** - Instant quality feedback vs manual review
2. **Consistency** - Standardized quality criteria across all content
3. **Improvement Guidance** - Specific, actionable suggestions
4. **Quality Assurance** - Catch issues before students see them

### **For Platform:**
1. **Content Quality** - Higher average quality across all courses
2. **Coach Satisfaction** - Tools that make their job easier
3. **Student Outcomes** - Better content = better learning
4. **Differentiation** - Unique AI-powered coaching tools

---

## 🎨 UI/UX Highlights

### **Content Quality Panel:**
- **Visual Hierarchy** - Large overall score, detailed breakdowns below
- **Color Coding** - Instant visual feedback (green/yellow/red)
- **Prioritization** - High/medium/low badges for improvements
- **Actionable** - Specific suggestions, not vague feedback
- **Encouraging** - Highlights strengths alongside improvements

### **Design Patterns:**
- Gradient backgrounds for AI features (purple/blue)
- Icon-based categorization
- Progress bars for scores
- Card-based layout for improvements
- Alert-style components for missing elements

---

## 📝 Next Steps

1. **Complete Phase 3.1 Integration**
   - Add ContentQualityPanel to content editor
   - Test with real content
   - Gather coach feedback

2. **Start Phase 3.2 (Exercise Generator)**
   - Design database schema
   - Build AI action for exercise generation
   - Create flashcard component
   - Implement export functionality

3. **Plan Phase 3.3 (Progress Insights)**
   - Define analytics queries
   - Design insight dashboard
   - Build AI summarization actions
   - Create intervention suggestion system

---

## 🔮 Future Enhancements

1. **Content Versioning**
   - Track quality scores over time
   - Show improvement trends
   - Compare versions

2. **Peer Comparison**
   - Anonymous benchmarking against other coaches
   - Industry best practices
   - Quality leaderboards

3. **Automated Improvements**
   - One-click apply suggestions
   - AI-powered content rewriting
   - Bulk content optimization

4. **Custom Quality Criteria**
   - Allow coaches to define their own standards
   - Institution-specific rubrics
   - Compliance checking

---

## 📚 Documentation

### **For Coaches:**
- How to use Content Quality Analyzer
- Understanding quality scores
- Implementing improvement suggestions
- Best practices for high-quality content

### **For Developers:**
- AI action architecture
- Prompt engineering guidelines
- Adding new quality dimensions
- Extending the analyzer

---

## ✨ Phase 3.1 Complete!

**Deliverables:**
- ✅ 1 new AI action (`content_analyze`)
- ✅ 1 new React component (`ContentQualityPanel`)
- ✅ Comprehensive quality analysis system
- ✅ Beautiful, actionable UI
- ✅ Full TypeScript type safety

**Ready for:** Integration into content editor and deployment

**Next Phase:** Practice Exercise Generator (Phase 3.2)
