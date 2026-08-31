-- Online Pati News CMS — Dummy Posts Seed Data

-- Insert a few dummy posts for each category to make the frontend functional
INSERT OR IGNORE INTO posts (title, slug, content, excerpt, category_id, status, published_at) VALUES
  ('प्रचण्ड र ओलीबीच भेटवार्ता', 'prachanda-oli-meeting', 'नेपालका प्रधानमन्त्री र विपक्षी दलका नेताबीच भेटवार्ता भएको छ।', 'प्रधानमन्त्री र ओलीबीच छलफल...', 2, 'published', datetime('now')),
  ('नेपालको आर्थिक वृद्धिदर बढ्ने', 'nepal-economy-growth', 'विश्व बैंकका अनुसार नेपालको आर्थिक वृद्धिदर यो वर्ष सुधार हुनेछ।', 'आर्थिक सुधारका संकेत...', 3, 'published', datetime('now')),
  ('नयाँ मोबाइल एप सार्वजनिक', 'new-app-launch', 'सूचना प्रविधि क्षेत्रमा नयाँ मोबाइल एप सार्वजनिक गरिएको छ।', 'प्रविधिमा नयाँ फड्को...', 7, 'published', datetime('now')),
  ('नेपालले जित्यो क्रिकेट म्याच', 'nepal-wins-cricket', 'नेपाली क्रिकेट टोलीले अन्तर्राष्ट्रिय खेलमा शानदार जित हासिल गरेको छ।', 'नेपालको ऐतिहासिक जित...', 8, 'published', datetime('now')),
  ('नयाँ फिल्मको ट्रेलर रिलिज', 'new-movie-trailer', 'नेपाली चलचित्र क्षेत्रमा नयाँ फिल्मको ट्रेलर चर्चामा छ।', 'मनोरञ्जन समाचार...', 9, 'published', datetime('now')),
  ('प्रदेश १ मा विकास आयोजना', 'province-1-development', 'प्रदेश नम्बर १ मा नयाँ विकास आयोजनाहरूको घोषणा गरिएको छ।', 'प्रदेश विकास समाचार...', 11, 'published', datetime('now')),
  ('फोटो फिचर: नेपालको प्राकृतिक सुन्दरता', 'photo-feature-nature', 'नेपालका सुन्दर हिमाल र पहाडहरूको फोटो फिचर।', 'सुन्दर नेपाल...', 12, 'published', datetime('now')),
  ('कभर स्टोरी: नेपालको पर्यटन', 'cover-story-tourism', 'नेपालको पर्यटन क्षेत्रमा आएको परिवर्तन बारे विशेष रिपोर्ट।', 'पर्यटन विशेष...', 13, 'published', datetime('now')),
  ('अन्तराष्ट्रिय सम्बन्ध सुधार', 'international-relations', 'नेपालको अन्य देशहरूसँगको सम्बन्ध सुधार हुँदै गएको छ।', 'विचार र विश्लेषण...', 14, 'published', datetime('now'));
