import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

// Get all published blog posts (public)
export const getAllPosts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, tag, featured, limit = '10', page = '1' } = req.query;

    const where: any = {
      status: 'PUBLISHED',
    };

    if (category) {
      where.category = category as string;
    }

    if (tag) {
      where.tags = { has: tag as string };
    }

    if (featured === 'true') {
      where.featured = true;
    }

    const take = parseInt(limit as string);
    const skip = (parseInt(page as string) - 1) * take;

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        take,
        skip,
        select: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          featuredImage: true,
          authorName: true,
          authorAvatar: true,
          category: true,
          tags: true,
          publishedAt: true,
          readTime: true,
          viewCount: true,
          featured: true,
        },
      }),
      prisma.blogPost.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        posts,
        pagination: {
          total,
          page: parseInt(page as string),
          limit: take,
          totalPages: Math.ceil(total / take),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get single blog post by slug (public)
export const getPostBySlug = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params;

    const post = await prisma.blogPost.findUnique({
      where: { slug },
    });

    if (!post || post.status !== 'PUBLISHED') {
      throw new AppError('Blog post not found', 404);
    }

    // Increment view count
    await prisma.blogPost.update({
      where: { id: post.id },
      data: { viewCount: { increment: 1 } },
    });

    res.json({
      success: true,
      data: { post },
    });
  } catch (error) {
    next(error);
  }
};

// Get all posts for admin (including drafts)
export const getAllPostsAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, limit = '50', page = '1' } = req.query;

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const take = parseInt(limit as string);
    const skip = (parseInt(page as string) - 1) * take;

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.blogPost.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        posts,
        pagination: {
          total,
          page: parseInt(page as string),
          limit: take,
          totalPages: Math.ceil(total / take),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get single post by ID (admin only)
export const getPostById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const post = await prisma.blogPost.findUnique({
      where: { id },
    });

    if (!post) {
      throw new AppError('Blog post not found', 404);
    }

    res.json({
      success: true,
      data: post,
    });
  } catch (error) {
    next(error);
  }
};

// Create blog post (admin only)
export const createPost = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      slug, title, excerpt, content, featuredImage,
      authorName, authorAvatar, category, tags,
      metaTitle, metaDescription, metaKeywords,
      status, featured, readTime,
    } = req.body;

    // Check if slug already exists
    const existing = await prisma.blogPost.findUnique({ where: { slug } });
    if (existing) {
      throw new AppError('A post with this slug already exists', 400);
    }

    const post = await prisma.blogPost.create({
      data: {
        slug,
        title,
        excerpt,
        content,
        featuredImage,
        authorName: authorName || 'DigiStore1 Team',
        authorAvatar,
        category: category || 'General',
        tags: tags || [],
        metaTitle: metaTitle || title,
        metaDescription: metaDescription || excerpt,
        metaKeywords: metaKeywords || [],
        status: status || 'DRAFT',
        featured: featured || false,
        readTime: readTime || 5,
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Blog post created successfully',
      data: { post },
    });
  } catch (error) {
    next(error);
  }
};

// Update blog post (admin only)
export const updatePost = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const {
      slug, title, excerpt, content, featuredImage,
      authorName, authorAvatar, category, tags,
      metaTitle, metaDescription, metaKeywords,
      status, featured, readTime,
    } = req.body;

    const existing = await prisma.blogPost.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Blog post not found', 404);
    }

    // Check if new slug conflicts with another post
    if (slug && slug !== existing.slug) {
      const slugConflict = await prisma.blogPost.findUnique({ where: { slug } });
      if (slugConflict) {
        throw new AppError('A post with this slug already exists', 400);
      }
    }

    // Set publishedAt if publishing for the first time
    let publishedAt = existing.publishedAt;
    if (status === 'PUBLISHED' && !existing.publishedAt) {
      publishedAt = new Date();
    }

    const post = await prisma.blogPost.update({
      where: { id },
      data: {
        slug: slug || existing.slug,
        title: title ?? existing.title,
        excerpt: excerpt ?? existing.excerpt,
        content: content ?? existing.content,
        featuredImage: featuredImage ?? existing.featuredImage,
        authorName: authorName ?? existing.authorName,
        authorAvatar: authorAvatar ?? existing.authorAvatar,
        category: category ?? existing.category,
        tags: tags ?? existing.tags,
        metaTitle: metaTitle ?? existing.metaTitle,
        metaDescription: metaDescription ?? existing.metaDescription,
        metaKeywords: metaKeywords ?? existing.metaKeywords,
        status: status ?? existing.status,
        featured: featured ?? existing.featured,
        readTime: readTime ?? existing.readTime,
        publishedAt,
      },
    });

    res.json({
      success: true,
      message: 'Blog post updated successfully',
      data: { post },
    });
  } catch (error) {
    next(error);
  }
};

// Delete blog post (admin only)
export const deletePost = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const existing = await prisma.blogPost.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Blog post not found', 404);
    }

    await prisma.blogPost.delete({ where: { id } });

    res.json({
      success: true,
      message: 'Blog post deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Get blog categories (public)
export const getCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const posts = await prisma.blogPost.findMany({
      where: { status: 'PUBLISHED' },
      select: { category: true },
    });

    const categoryCounts: Record<string, number> = {};
    posts.forEach(post => {
      categoryCounts[post.category] = (categoryCounts[post.category] || 0) + 1;
    });

    const categories = Object.entries(categoryCounts).map(([name, count]) => ({
      name,
      count,
    }));

    res.json({
      success: true,
      data: { categories },
    });
  } catch (error) {
    next(error);
  }
};

