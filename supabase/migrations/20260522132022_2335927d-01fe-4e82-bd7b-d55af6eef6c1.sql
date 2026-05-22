CREATE OR REPLACE FUNCTION to_title_case(input TEXT)
RETURNS TEXT AS $$
DECLARE
  words TEXT[];
  result TEXT[];
  word TEXT;
  lower_words TEXT[] := ARRAY[
    'a','o','as','os','um','uma','uns','umas',
    'de','da','do','das','dos',
    'em','na','no','nas','nos',
    'por','para','com','sem','sob','sobre',
    'entre','até','após','ante','perante',
    'e','ou','mas','nem','que','se','pois',
    'logo','porém','contudo','todavia','entretanto','portanto'
  ];
  i INT;
BEGIN
  -- Normalize spaces
  input := trim(regexp_replace(input, '\s+', ' ', 'g'));
  IF input = '' OR input IS NULL THEN
    RETURN input;
  END IF;
  
  words := string_to_array(input, ' ');
  
  FOR i IN 1..array_length(words, 1) LOOP
    word := lower(words[i]);
    IF i = 1 THEN
      -- Always capitalize the first word
      result := array_append(result, initcap(words[i]));
    ELSIF word = ANY(lower_words) THEN
      -- Keep lowercase words lowercase
      result := array_append(result, word);
    ELSE
      -- Capitalize all other words
      result := array_append(result, initcap(words[i]));
    END IF;
  END LOOP;
  
  RETURN array_to_string(result, ' ');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Re-apply to ALL existing campaigns with the corrected function
UPDATE campaigns
SET name = to_title_case(name)
WHERE name IS NOT NULL AND name != '';