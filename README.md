# ITS Scanner

A React application for scanning ITS numbers and storing them in a Supabase database.

## Supabase Setup

### 1. Environment Variables

Create a `.env` file in the root directory with your Supabase configuration:

```env
REACT_APP_SUPABASE_KEY=your_supabase_anon_key_here
```

To get your Supabase anon key:
1. Go to your Supabase project dashboard
2. Navigate to Settings > API
3. Copy the "anon public" key from the Project API keys section

### 2. Database Setup

Make sure your Supabase database has the following tables:

#### `users` table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  its_number VARCHAR(8) UNIQUE NOT NULL,
  role VARCHAR(10) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### `scans` table
```sql
CREATE TABLE scans (
  id SERIAL PRIMARY KEY,
  its_number VARCHAR(8) NOT NULL,
  scanned_at TIMESTAMP DEFAULT NOW()
);
```

### 3. Row Level Security (RLS)

Enable RLS on the `scans` table and create policies:

```sql
-- Enable RLS
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;

-- Policy for inserting scans (any authenticated user)
CREATE POLICY "Allow authenticated users to insert scans" ON scans
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policy for viewing scans (any authenticated user for now)
CREATE POLICY "Allow authenticated users to view scans" ON scans
  FOR SELECT USING (auth.role() = 'authenticated');

-- Alternative: If you want to disable RLS for testing
-- ALTER TABLE scans DISABLE ROW LEVEL SECURITY;
```

## Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
