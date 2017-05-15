A nice little CSS garbage collecting tool which knows about that DOM changes over time. To track changes and make sure only unused CSS rules will get removed it uses `MutationObserver`.

## Usage

1. Add this JS file to your project;
2. Open a pages of your application;
3. Press Alt+R (start recording);
4. Click through the page trying to use all the functionality;
5. Press Alt+A (remember newly used rules);
6. Repeat 3-5 until there are pages left;
7. Press Alt+S to get all the used rules.

Yeap, feel like a robot or, better, integrate this tool in your integration testing process to prove your app has no unused CSS rules at all!

Feel free help with the code, if you've found this tool useful.